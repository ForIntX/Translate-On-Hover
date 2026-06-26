// ===== Hızlı Çeviri - background.js =====
// Kullanıcının kendi girdiği çeviri API yapılandırmasını kullanır.
// Eklenti hiçbir API'ye varsayılan olarak bağlı gelmez — kullanıcı
// ayarlardan kendi endpoint'ini/key'ini girmediği sürece çeviri yapılmaz.

const API_REQUEST_DELAY_MS = 100;
const DEFAULT_GET_CHUNK_LENGTH = 450;
const DEFAULT_POST_CHUNK_LENGTH = 1100;
const translationCache = new Map(); // key: `${text}_${targetLang}_${mode}` -> {translation, detectedLang}
const requestQueue = [];
const cancelledRequestIds = new Set(); // kullanıcının vazgeçtiği (kart kapatılan) istekler
let isProcessing = false;

const UI_TEXT = {
  tr: {
    emptyText: "Çevrilecek metin boş.",
    apiNotConfigured: "API yapılandırılmadı. Eklenti ayarlarından bir çeviri API'si ekleyin.",
    translationFailed: "Çeviri alınamadı",
    apiHttpError: (status) => `API hatası: HTTP ${status}`,
    translationNotFound: "Çeviri bulunamadı (responsePath ayarını kontrol edin)",
  },
  en: {
    emptyText: "There is no text to translate.",
    apiNotConfigured: "API is not configured. Add a translation API from the extension settings.",
    translationFailed: "Could not get translation",
    apiHttpError: (status) => `API error: HTTP ${status}`,
    translationNotFound: "Translation not found (check the responsePath setting)",
  },
};

function getUiLang(lang) {
  return UI_TEXT[lang] ? lang : "tr";
}

function getText(lang, key, ...args) {
  const value = UI_TEXT[getUiLang(lang)][key] || UI_TEXT.tr[key] || key;
  return typeof value === "function" ? value(...args) : value;
}

function userError(key, ...args) {
  const error = new Error(key);
  error.userMessageKey = key;
  error.userMessageArgs = args;
  return error;
}

function formatError(error, lang) {
  if (error && error.userMessageKey) {
    return getText(lang, error.userMessageKey, ...(error.userMessageArgs || []));
  }
  return error?.message || getText(lang, "translationFailed");
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "translate") {
    handleTranslateRequest(request, sendResponse);
    return true; // asenkron cevap için gerekli
  }
  if (request.action === "cancelTranslation") {
    if (request.requestId != null) {
      cancelledRequestIds.add(request.requestId);
      // Kuyrukta hâlâ bekliyorsa direkt çıkar; bu kuyruğu tıkamasın.
      for (let i = requestQueue.length - 1; i >= 0; i--) {
        if (requestQueue[i].requestId === request.requestId) {
          requestQueue.splice(i, 1);
        }
      }
    }
    return false;
  }
});

async function handleTranslateRequest(request, sendResponse) {
  const text = normalizeInputText(request.text);
  const targetLang = request.targetLang || "tr";
  const uiLang = getUiLang(request.uiLang);
  const shouldChunk = request.chunk === true;
  const cacheKey = `${text.toLowerCase()}_${targetLang}_${shouldChunk ? "chunked" : "single"}`;
  const requestId = request.requestId;

  if (!text) {
    sendResponse({ error: getText(uiLang, "emptyText") });
    return;
  }

  // 1. Önbellekte varsa hemen gönder
  if (translationCache.has(cacheKey)) {
    sendResponse(translationCache.get(cacheKey));
    return;
  }

  // 2. API yapılandırılmış mı kontrol et
  const { apiConfig } = await chrome.storage.sync.get(["apiConfig"]);
  if (!apiConfig || !apiConfig.url) {
    sendResponse({
      error: getText(uiLang, "apiNotConfigured"),
      needsConfig: true,
    });
    return;
  }

  // Beklerken zaten iptal edilmişse (kart hemen kapatıldıysa) hiç kuyruğa girme
  if (requestId != null && cancelledRequestIds.has(requestId)) {
    cancelledRequestIds.delete(requestId);
    return;
  }

  // 3. Kuyruğa ekle (aynı kelime+dil için bekleyen başka istekler varsa, hepsi
  //    tek API çağrısıyla birlikte cevaplanacak)
  requestQueue.push({ text, targetLang, uiLang, cacheKey, apiConfig, shouldChunk, requestId, sendResponse });
  processQueue();
}

function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;
  isProcessing = true;

  const job = requestQueue.shift();
  const { text, targetLang, uiLang, cacheKey, apiConfig, shouldChunk, requestId } = job;

  const sameKeyJobs = [job];
  for (let i = requestQueue.length - 1; i >= 0; i--) {
    if (requestQueue[i].cacheKey === cacheKey) {
      sameKeyJobs.push(requestQueue.splice(i, 1)[0]);
    }
  }

  const isCancelled = () => requestId != null && cancelledRequestIds.has(requestId);

  // API'yi yormamak için istekler arası minik bekleme
  setTimeout(() => {
    if (isCancelled()) {
      cancelledRequestIds.delete(requestId);
      isProcessing = false;
      processQueue();
      return;
    }

    translateText(text, targetLang, apiConfig, { chunk: shouldChunk, isCancelled })
      .then((result) => {
        if (result && result.cancelled) return;
        translationCache.set(cacheKey, result);
        for (const j of sameKeyJobs) j.sendResponse(result);
      })
      .catch((error) => {
        console.error("Çeviri API hatası:", error);
        for (const j of sameKeyJobs) {
          j.sendResponse({ error: formatError(error, j.uiLang || uiLang) });
        }
      })
      .finally(() => {
        if (requestId != null) cancelledRequestIds.delete(requestId);
        isProcessing = false;
        processQueue();
      });
  }, API_REQUEST_DELAY_MS);
}

async function translateText(text, targetLang, apiConfig, options = {}) {
  const isCancelled = options.isCancelled || (() => false);

  if (!options.chunk) {
    return fetchFromCustomApi(text, targetLang, apiConfig);
  }

  const chunkLength = getChunkLength(apiConfig);
  const groups = buildTranslationGroups(text, chunkLength);
  const totalChunks = groups.reduce((sum, group) => sum + group.length, 0);

  if (groups.length === 1 && groups[0].length === 1) {
    return fetchFromCustomApi(groups[0][0], targetLang, apiConfig);
  }

  const translatedParagraphs = [];
  let translatedChunkCount = 0;

  for (const group of groups) {
    if (isCancelled()) return { cancelled: true };
    const translatedChunks = [];

    for (const chunk of group) {
      if (isCancelled()) return { cancelled: true };

      const result = await fetchFromCustomApi(chunk, targetLang, apiConfig);
      translatedChunks.push(result.translation.trim());
      translatedChunkCount++;

      if (translatedChunkCount < totalChunks) {
        await wait(API_REQUEST_DELAY_MS);
      }
    }

    translatedParagraphs.push(joinTranslatedChunks(translatedChunks));
  }

  return {
    translation: translatedParagraphs.join("\n\n").trim(),
    chunks: translatedChunkCount,
  };
}

// Kullanıcının ayarlardan girdiği yapılandırmaya göre genel bir API çağrısı yapar.
//
// apiConfig şu alanları içerir:
//   url            : İstek atılacak tam URL. {{text}} ve {{targetLang}} yer
//                    tutucuları varsa URL içinde değiştirilir (GET tarzı API'ler için).
//   method         : "GET" veya "POST" (varsayılan GET)
//   headers        : { "Header-Adı": "değer" } şeklinde obje (API key burada gider,
//                    örn. { "Authorization": "Bearer xxx" } veya { "X-Api-Key": "xxx" })
//   bodyTemplate   : POST için gönderilecek body. JSON string olarak yazılır,
//                    içinde {{text}} ve {{targetLang}} yer tutucuları kullanılabilir.
//   responsePath   : Çeviriyi response JSON'ından çıkarmak için nokta gösterimi
//                    yol (örn. "data.translations.0.translatedText").
async function fetchFromCustomApi(text, targetLang, apiConfig) {
  const fill = (template) =>
    template
      .replaceAll("{{text}}", encodeURIComponent(text))
      .replaceAll("{{targetLang}}", encodeURIComponent(targetLang));

  const url = fill(apiConfig.url);
  const method = (apiConfig.method || "GET").toUpperCase();

  const fetchOptions = { method, headers: { ...(apiConfig.headers || {}) } };

  if (method === "POST" && apiConfig.bodyTemplate) {
    const bodyStr = fillBodyTemplate(apiConfig.bodyTemplate, text, targetLang, fetchOptions.headers);
    fetchOptions.body = bodyStr;
    if (!getHeaderValue(fetchOptions.headers, "Content-Type")) {
      fetchOptions.headers["Content-Type"] = "application/json";
    }
  }

  const response = await fetch(url, fetchOptions);
  if (!response.ok) {
    throw userError("apiHttpError", response.status);
  }

  const data = await response.json();
  const translation = extractByPath(data, apiConfig.responsePath);
  const translationText = normalizeTranslationValue(translation);

  if (!translationText) {
    throw userError("translationNotFound");
  }

  return { translation: translationText };
}

function buildTranslationGroups(text, maxChunkLength) {
  return normalizeInputText(text)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean)
    .map((paragraph) => splitParagraphIntoChunks(paragraph, maxChunkLength));
}

function splitParagraphIntoChunks(paragraph, maxChunkLength) {
  const sentences = splitIntoSentences(paragraph);
  return sentences.flatMap((sentence) => {
    if (sentence.length <= maxChunkLength) return [sentence];
    return splitLongText(sentence, maxChunkLength);
  });
}

function splitIntoSentences(text) {
  const sentences = text.match(/[^.!?。！？]+[.!?。！？]+["')\]]*|[^.!?。！？]+$/gu);
  return sentences ? sentences.map((sentence) => sentence.trim()).filter(Boolean) : [text];
}

function splitLongText(text, maxChunkLength) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const word of words) {
    if (word.length > maxChunkLength) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      chunks.push(...splitLongWord(word, maxChunkLength));
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChunkLength && current) {
      chunks.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function splitLongWord(word, maxChunkLength) {
  const chunks = [];
  for (let i = 0; i < word.length; i += maxChunkLength) {
    chunks.push(word.slice(i, i + maxChunkLength));
  }
  return chunks;
}

function joinTranslatedChunks(chunks) {
  return chunks
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .join(" ");
}

function getChunkLength(apiConfig) {
  if (Number.isInteger(apiConfig.maxChunkLength) && apiConfig.maxChunkLength > 50) {
    return apiConfig.maxChunkLength;
  }

  return getRequestMethod(apiConfig) === "GET" ? DEFAULT_GET_CHUNK_LENGTH : DEFAULT_POST_CHUNK_LENGTH;
}

function getRequestMethod(apiConfig) {
  return (apiConfig.method || "GET").toUpperCase();
}

function normalizeInputText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTranslationValue(value) {
  if (value === undefined || value === null) return "";

  if (Array.isArray(value)) {
    return value.map(normalizeTranslationValue).filter(Boolean).join("\n");
  }

  if (typeof value === "object") {
    return normalizeTranslationValue(
      value.translatedText ?? value.translation ?? value.text ?? value.value ?? JSON.stringify(value)
    );
  }

  return String(value).trim();
}

function fillBodyTemplate(template, text, targetLang, headers = {}) {
  const contentType = getHeaderValue(headers, "Content-Type").toLowerCase();

  if (contentType.includes("application/x-www-form-urlencoded")) {
    return template
      .replaceAll("{{text}}", encodeURIComponent(text))
      .replaceAll("{{targetLang}}", encodeURIComponent(targetLang));
  }

  if (!contentType || contentType.includes("application/json")) {
    return template
      .replaceAll("{{text}}", escapeJsonStringValue(text))
      .replaceAll("{{targetLang}}", escapeJsonStringValue(targetLang));
  }

  return template.replaceAll("{{text}}", text).replaceAll("{{targetLang}}", targetLang);
}

function escapeJsonStringValue(value) {
  return JSON.stringify(String(value)).slice(1, -1);
}

function getHeaderValue(headers, name) {
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return entry ? String(entry[1]) : "";
}

// "data.translations.0.translatedText" gibi bir yolu obje üzerinde gezerek değeri çıkarır.
function extractByPath(obj, path) {
  if (!path) return undefined;
  return path.split(".").reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    return acc[key];
  }, obj);
}
