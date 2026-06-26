const enabledEl = document.getElementById("enabled");
const interfaceLangEl = document.getElementById("interfaceLang");
const targetLangEl = document.getElementById("targetLang");
const delayEl = document.getElementById("delay");

const apiPasteEl = document.getElementById("apiPaste");
const saveApiBtn = document.getElementById("saveApi");
const apiStatusEl = document.getElementById("apiStatus");
const noApiWarningEl = document.getElementById("noApiWarning");
const formatHintEl = document.getElementById("formatHint");

const UI_TEXT = {
  tr: {
    appTitle: "🔤 Translate on Hover",
    interfaceLanguage: "Uygulama dili",
    enabled: "Etkin",
    targetLanguage: "Hedef dil",
    delay: "Bekleme (ms)",
    translationApi: "Çeviri API'si",
    noApiWarning: "⚠️ Henüz bir çeviri API'si eklemediniz. Çeviri çalışmayacak.",
    apiPasteLabel: "API yapılandırmanı buraya yapıştır (JSON)",
    apiPastePlaceholder:
      '{"url": "...", "method": "POST", "headers": {...}, "bodyTemplate": "...", "responsePath": "..."}',
    formatSummary: "JSON formatı nasıl olmalı?",
    formatHint:
      '<code>{{text}}</code> ve <code>{{targetLang}}</code> yer tutucuları URL veya bodyTemplate içinde otomatik değiştirilir. GET istekleri için headers ve bodyTemplate\'i boş bırakabilirsiniz. Hazır örnekler (DeepL, LibreTranslate, Google Cloud Translate, MyMemory) için projenin README dosyasına bakın.',
    save: "Kaydet",
    apiCleared: "API yapılandırması temizlendi.",
    invalidJson: "Geçerli bir JSON değil. Formatı kontrol edin.",
    urlRequired: '"url" alanı zorunlu ve metin (string) olmalı.',
    apiSaved: "API ayarları kaydedildi ✓",
    languageTurkish: "Türkçe",
    languageEnglish: "İngilizce",
    languageGerman: "Almanca",
    languageFrench: "Fransızca",
    languageSpanish: "İspanyolca",
    languageRussian: "Rusça",
    languageArabic: "Arapça",
    languageItalian: "İtalyanca",
    languageJapanese: "Japonca",
  },
  en: {
    appTitle: "🔤 Translate on Hover",
    interfaceLanguage: "App language",
    enabled: "Enabled",
    targetLanguage: "Target language",
    delay: "Delay (ms)",
    translationApi: "Translation API",
    noApiWarning: "⚠️ You have not added a translation API yet. Translation will not work.",
    apiPasteLabel: "Paste your API configuration here (JSON)",
    apiPastePlaceholder:
      '{"url": "...", "method": "POST", "headers": {...}, "bodyTemplate": "...", "responsePath": "..."}',
    formatSummary: "What should the JSON format look like?",
    formatHint:
      '<code>{{text}}</code> and <code>{{targetLang}}</code> placeholders are replaced automatically in the URL or bodyTemplate. For GET requests, you can leave headers and bodyTemplate empty. See the project README for ready-made examples (DeepL, LibreTranslate, Google Cloud Translate, MyMemory).',
    save: "Save",
    apiCleared: "API configuration cleared.",
    invalidJson: "This is not valid JSON. Check the format.",
    urlRequired: '"url" is required and must be a string.',
    apiSaved: "API settings saved ✓",
    languageTurkish: "Turkish",
    languageEnglish: "English",
    languageGerman: "German",
    languageFrench: "French",
    languageSpanish: "Spanish",
    languageRussian: "Russian",
    languageArabic: "Arabic",
    languageItalian: "Italian",
    languageJapanese: "Japanese",
  },
};

let currentInterfaceLang = "tr";
let hasApiConfig = false;
let currentApiStatus = null;

function getText(key) {
  return UI_TEXT[currentInterfaceLang]?.[key] || UI_TEXT.tr[key] || key;
}

function applyInterfaceLanguage(lang) {
  currentInterfaceLang = UI_TEXT[lang] ? lang : "tr";
  document.documentElement.lang = currentInterfaceLang;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = getText(el.dataset.i18n);
  });

  document.querySelectorAll("option[data-label-key]").forEach((option) => {
    option.textContent = getText(option.dataset.labelKey);
  });

  apiPasteEl.placeholder = getText("apiPastePlaceholder");
  formatHintEl.innerHTML = getText("formatHint");
  updateNoApiWarning(hasApiConfig);
  if (currentApiStatus) {
    renderApiStatus();
  }
}

function updateNoApiWarning(hasApi) {
  hasApiConfig = hasApi;
  noApiWarningEl.textContent = getText("noApiWarning");
  noApiWarningEl.style.display = hasApi ? "none" : "block";
}

// Mevcut ayarları yükle
chrome.storage.sync.get(
  { enabled: true, interfaceLang: "tr", targetLang: "tr", delay: 400, apiConfig: null },
  (data) => {
    interfaceLangEl.value = data.interfaceLang;
    enabledEl.checked = data.enabled;
    targetLangEl.value = data.targetLang;
    delayEl.value = data.delay;
    applyInterfaceLanguage(data.interfaceLang);

    if (data.apiConfig && data.apiConfig.url) {
      apiPasteEl.value = JSON.stringify(data.apiConfig, null, 2);
      updateNoApiWarning(true);
    } else {
      updateNoApiWarning(false);
    }
  }
);

interfaceLangEl.addEventListener("change", () => {
  applyInterfaceLanguage(interfaceLangEl.value);
  chrome.storage.sync.set({ interfaceLang: interfaceLangEl.value });
});

enabledEl.addEventListener("change", () => {
  chrome.storage.sync.set({ enabled: enabledEl.checked });
});

targetLangEl.addEventListener("change", () => {
  chrome.storage.sync.set({ targetLang: targetLangEl.value });
});

delayEl.addEventListener("change", () => {
  const val = Math.max(0, Math.min(2000, Number(delayEl.value) || 400));
  delayEl.value = val;
  chrome.storage.sync.set({ delay: val });
});

function showApiStatus(messageKey, isError) {
  currentApiStatus = { messageKey, isError };
  renderApiStatus();
}

function renderApiStatus() {
  apiStatusEl.textContent = getText(currentApiStatus.messageKey);
  apiStatusEl.className = currentApiStatus.isError ? "error" : "success";
}

saveApiBtn.addEventListener("click", () => {
  const raw = apiPasteEl.value.trim();

  if (!raw) {
    chrome.storage.sync.set({ apiConfig: null }, () => {
      showApiStatus("apiCleared", false);
      updateNoApiWarning(false);
    });
    return;
  }

  let apiConfig;
  try {
    apiConfig = JSON.parse(raw);
  } catch (e) {
    showApiStatus("invalidJson", true);
    return;
  }

  if (!apiConfig.url || typeof apiConfig.url !== "string") {
    showApiStatus("urlRequired", true);
    return;
  }

  apiConfig.method = (apiConfig.method || "GET").toUpperCase();
  apiConfig.headers = apiConfig.headers || {};
  apiConfig.bodyTemplate = apiConfig.bodyTemplate || "";
  apiConfig.responsePath = apiConfig.responsePath || "";

  chrome.storage.sync.set({ apiConfig }, () => {
    showApiStatus("apiSaved", false);
    updateNoApiWarning(true);
  });
});
