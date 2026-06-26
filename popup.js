const enabledEl = document.getElementById("enabled");
const targetLangEl = document.getElementById("targetLang");
const delayEl = document.getElementById("delay");

const apiPasteEl = document.getElementById("apiPaste");
const saveApiBtn = document.getElementById("saveApi");
const apiStatusEl = document.getElementById("apiStatus");
const noApiWarningEl = document.getElementById("noApiWarning");

function updateNoApiWarning(hasApi) {
  noApiWarningEl.style.display = hasApi ? "none" : "block";
}

// Mevcut ayarları yükle
chrome.storage.sync.get(
  { enabled: true, targetLang: "tr", delay: 400, apiConfig: null },
  (data) => {
    enabledEl.checked = data.enabled;
    targetLangEl.value = data.targetLang;
    delayEl.value = data.delay;

    if (data.apiConfig && data.apiConfig.url) {
      apiPasteEl.value = JSON.stringify(data.apiConfig, null, 2);
      updateNoApiWarning(true);
    } else {
      updateNoApiWarning(false);
    }
  }
);

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

function showApiStatus(message, isError) {
  apiStatusEl.textContent = message;
  apiStatusEl.className = isError ? "error" : "success";
}

saveApiBtn.addEventListener("click", () => {
  const raw = apiPasteEl.value.trim();

  if (!raw) {
    chrome.storage.sync.set({ apiConfig: null }, () => {
      showApiStatus("API yapılandırması temizlendi.", false);
      updateNoApiWarning(false);
    });
    return;
  }

  let apiConfig;
  try {
    apiConfig = JSON.parse(raw);
  } catch (e) {
    showApiStatus("Geçerli bir JSON değil. Formatı kontrol edin.", true);
    return;
  }

  if (!apiConfig.url || typeof apiConfig.url !== "string") {
    showApiStatus('"url" alanı zorunlu ve metin (string) olmalı.', true);
    return;
  }

  apiConfig.method = (apiConfig.method || "GET").toUpperCase();
  apiConfig.headers = apiConfig.headers || {};
  apiConfig.bodyTemplate = apiConfig.bodyTemplate || "";
  apiConfig.responsePath = apiConfig.responsePath || "";

  chrome.storage.sync.set({ apiConfig }, () => {
    showApiStatus("API ayarları kaydedildi ✓", false);
    updateNoApiWarning(true);
  });
});
