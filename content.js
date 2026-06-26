// ===== Hızlı Çeviri - content.js =====

let hoverTimer = null;
let currentHoveredWord = "";
let hasActiveSelection = false; // seçim varken hover sistemini bastırmak için
let panelWordTimer = null;
let currentPanelHoveredWord = "";
let currentPanelWordRect = null;
let currentTooltipAnchorRect = null;

let settings = {
  enabled: true,
  interfaceLang: "tr",
  targetLang: "tr",
  delay: 400,
  triggerMode: "hover", // "hover" = üstüne gelince çevir, "click" = üstüne gelip tıklayınca çevir
};

const UI_TEXT = {
  tr: {
    error: "Hata!",
    translateButton: "🌐 Çevir",
    translating: "Çevriliyor...",
    translationUnavailable: "Çeviri alınamadı.",
    translationLabel: "↓ çeviri",
  },
  en: {
    error: "Error!",
    translateButton: "🌐 Translate",
    translating: "Translating...",
    translationUnavailable: "Could not get translation.",
    translationLabel: "↓ translation",
  },
};

function getText(key) {
  const lang = UI_TEXT[settings.interfaceLang] ? settings.interfaceLang : "tr";
  return UI_TEXT[lang][key] || UI_TEXT.tr[key] || key;
}

chrome.storage.sync.get(["enabled", "interfaceLang", "targetLang", "delay", "triggerMode"], (data) => {
  settings = { ...settings, ...data };
});

chrome.storage.onChanged.addListener((changes) => {
  for (const key in changes) {
    settings[key] = changes[key].newValue;
  }
  if (changes.interfaceLang) {
    updateVisibleInterfaceText();
  }
  if (changes.enabled && changes.enabled.newValue === false) {
    removeTooltip();
    removeHighlight();
    removeSelectionButton();
    removeSelectionCard();
    currentHoveredWord = "";
    hasActiveSelection = false;
  }
  if (changes.triggerMode) {
    clearTimeout(hoverTimer);
    removeTooltip();
    removeHighlight();
    currentHoveredWord = "";
  }
});

function isEditable(target) {
  return (
    target &&
    target.closest &&
    target.closest("input, textarea, [contenteditable='true'], [contenteditable='']") !== null
  );
}

document.addEventListener("mousemove", (event) => {
  if (!settings.enabled) return;
  if (settings.triggerMode === "click") return; // tıklama modunda hover ile tetiklenmez
  if (hasActiveSelection) return; // bir cümle seçiliyken kelime hover'ı devre dışı
  if (event.target.closest && event.target.closest(".qt-selection-ui")) {
    resetPageHover();
    return;
  }
  if (document.getElementById("qt-selection-card")) {
    resetPageHover();
    return;
  }
  if (isEditable(event.target)) return;

  clearTimeout(hoverTimer);
  removeHighlight(); // fare hareket ettiğinde eski vurguyu sil

  const wordData = getWordDataAtPoint(event.clientX, event.clientY);

  if (!wordData || wordData.word === currentHoveredWord) {
    if (!wordData) {
      removeTooltip();
      currentHoveredWord = "";
    }
    return;
  }

  const clientX = event.clientX;
  const clientY = event.clientY;

  hoverTimer = setTimeout(() => {
    triggerWordTranslation(wordData, clientX, clientY);
  }, settings.delay);
});

// Tıklama modu: kelimenin üstüne gelip tıklayınca çevir
document.addEventListener("click", (event) => {
  if (!settings.enabled) return;
  if (settings.triggerMode !== "click") return;
  if (event.target.closest && event.target.closest(".qt-selection-ui")) return;
  if (document.getElementById("qt-selection-card")) return;
  if (isEditable(event.target)) return;

  // Sürükleyerek bir metin seçildiyse, bu bir kelime tıklaması değildir;
  // seçim akışı (mouseup) zaten devreye girer.
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && getSelectedText(selection).length >= 2) return;

  const wordData = getWordDataAtPoint(event.clientX, event.clientY);
  if (!wordData) {
    resetPageHover();
    return;
  }

  if (wordData.word === currentHoveredWord) return; // aynı kelimeye tekrar tıklama, kutucuk zaten açık

  triggerWordTranslation(wordData, event.clientX, event.clientY);
});

function triggerWordTranslation(wordData, clientX, clientY) {
  currentHoveredWord = wordData.word;

  // Kelimenin çevresini vurgula
  showHighlight(wordData.range);

  // Kutucuğu göster (başlangıçta "...")
  showTooltip(clientX, clientY, "...");

  chrome.runtime.sendMessage(
    {
      action: "translate",
      text: wordData.word,
      targetLang: settings.targetLang,
      uiLang: settings.interfaceLang,
    },
    (response) => {
      if (chrome.runtime.lastError) {
        updateTooltip(getText("error"), true);
        return;
      }
      if (response && response.translation) {
        updateTooltip(response.translation);
      } else if (response && response.error) {
        updateTooltip(response.error, true);
      } else {
        updateTooltip(getText("error"), true);
      }
    }
  );
}

// Tıklama veya scroll durumunda temizle
document.addEventListener("mousedown", (event) => {
  // Kendi butonumuza/kartımıza tıklanıyorsa seçimi/kartı koru
  if (event.target.closest && event.target.closest(".qt-selection-ui")) return;
  removeTooltip();
  removeHighlight();
  removeSelectionButton();
  removeSelectionCard();
  hasActiveSelection = false;
  if (settings.triggerMode === "click") {
    currentHoveredWord = "";
  }
});
window.addEventListener("scroll", () => {
  removeTooltip();
  removeHighlight();
  removeSelectionButton();
  if (!document.getElementById("qt-selection-card")) {
    hasActiveSelection = false;
  }
}, true);
document.addEventListener("mouseleave", () => {
  removeTooltip();
  removeHighlight();
  currentHoveredWord = "";
});

// ===== Cümle / Çoklu Kelime Seçim Çevirisi =====

document.addEventListener("mouseup", (event) => {
  // Kendi UI elemanlarımıza tıklanmasını görmezden gel
  if (event.target.closest && event.target.closest(".qt-selection-ui")) return;
  if (!settings.enabled) return;
  if (isEditable(event.target)) return;
  resetPageHover();

  // Seçimin DOM'a yansıması için bir tık bekle
  setTimeout(() => {
    const selection = window.getSelection();
    const text = getSelectedText(selection);

    if (!selection || selection.isCollapsed || !text || text.length < 2) {
      hasActiveSelection = false;
      removeSelectionButton();
      return;
    }

    hasActiveSelection = true;
    removeTooltip();
    removeHighlight();

    const rect = getSelectionRect(selection);
    if (!rect) return;
    showSelectionButton(rect, text);
  }, 0);
});

function showSelectionButton(rect, text) {
  removeSelectionButton();
  const btn = document.createElement("button");
  btn.id = "qt-selection-button";
  btn.className = "qt-selection-ui";
  btn.innerText = getText("translateButton");

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeSelectionButton();
    showSelectionCard(text, getText("translating"));

    chrome.runtime.sendMessage(
      {
        action: "translate",
        text,
        targetLang: settings.targetLang,
        uiLang: settings.interfaceLang,
        chunk: true,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          updateSelectionCard(getText("translationUnavailable"), true);
          return;
        }
        if (response && response.translation) {
          updateSelectionCard(response.translation);
        } else if (response && response.error) {
          updateSelectionCard(response.error, true);
        } else {
          updateSelectionCard(getText("translationUnavailable"), true);
        }
      }
    );
  });

  document.body.appendChild(btn);
  positionSelectionButton(btn, rect);
}

function removeSelectionButton() {
  const btn = document.getElementById("qt-selection-button");
  if (btn) btn.remove();
}

function showSelectionCard(originalText, translatedPlaceholder) {
  removeSelectionCard();
  resetPageHover();

  const card = document.createElement("div");
  card.id = "qt-selection-card";
  card.className = "qt-selection-ui";

  const closeBtn = document.createElement("button");
  closeBtn.className = "qt-card-close";
  closeBtn.innerText = "×";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    removeSelectionCard();
    hasActiveSelection = false;
    const selection = window.getSelection();
    if (selection) selection.removeAllRanges();
  });

  const originalEl = document.createElement("div");
  originalEl.className = "qt-card-original qt-card-text";
  originalEl.innerText = originalText;

  const arrowEl = document.createElement("div");
  arrowEl.className = "qt-card-arrow";
  arrowEl.innerText = getText("translationLabel");

  const translatedEl = document.createElement("div");
  translatedEl.className = "qt-card-translated qt-card-text";
  translatedEl.id = "qt-card-translated-text";
  translatedEl.dataset.state = "loading";
  translatedEl.tabIndex = 0;
  translatedEl.innerText = translatedPlaceholder;

  card.appendChild(closeBtn);
  card.appendChild(originalEl);
  card.appendChild(arrowEl);
  card.appendChild(translatedEl);
  document.body.appendChild(card);
  card.addEventListener("mousemove", handlePanelWordMouseMove);
  card.addEventListener("mouseleave", clearPanelWordHover);

  // Ekranın ortasına yakın, sabit bir konuma yerleştir (uzun metinler için en okunaklı yer)
  card.style.left = "50%";
  card.style.top = "24px";
}

function updateSelectionCard(text, isError = false) {
  const el = document.getElementById("qt-card-translated-text");
  if (el) {
    el.dataset.state = isError ? "error" : "ready";
    el.innerText = text;
    el.classList.toggle("qt-error", isError);
  }
}

function removeSelectionCard() {
  const card = document.getElementById("qt-selection-card");
  if (card) card.remove();
  clearPanelWordHover();
}

function getSelectedText(selection) {
  if (!selection || selection.rangeCount === 0) return "";

  const ranges = [];
  for (let i = 0; i < selection.rangeCount; i++) {
    ranges.push(selection.getRangeAt(i).toString());
  }

  return ranges
    .join("\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

function getSelectionRect(selection) {
  if (!selection || selection.rangeCount === 0) return null;

  const rects = [];
  for (let i = 0; i < selection.rangeCount; i++) {
    rects.push(...Array.from(selection.getRangeAt(i).getClientRects()));
  }

  const visibleRects = rects.filter((rect) => rect.width > 0 && rect.height > 0);
  if (visibleRects.length === 0) return null;

  const left = Math.min(...visibleRects.map((rect) => rect.left));
  const top = Math.min(...visibleRects.map((rect) => rect.top));
  const right = Math.max(...visibleRects.map((rect) => rect.right));
  const bottom = Math.max(...visibleRects.map((rect) => rect.bottom));

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function handlePanelWordMouseMove(event) {
  if (!settings.enabled) return;
  if (!event.target.closest || !event.target.closest(".qt-card-text")) {
    clearPanelWordHover();
    return;
  }

  const wordData = getWordDataAtPoint(event.clientX, event.clientY);
  if (!wordData) {
    clearPanelWordHover();
    return;
  }

  const wordRect = getFirstVisibleRect(wordData.range);
  if (!wordRect) {
    clearPanelWordHover();
    return;
  }

  if (wordData.word === currentPanelHoveredWord) {
    currentPanelWordRect = wordRect;
    positionCardWordTooltip();
    return;
  }

  clearTimeout(panelWordTimer);
  currentPanelHoveredWord = wordData.word;
  currentPanelWordRect = wordRect;

  panelWordTimer = setTimeout(() => {
    showCardWordTooltip("...");
    chrome.runtime.sendMessage(
      {
        action: "translate",
        text: wordData.word,
        targetLang: settings.targetLang,
        uiLang: settings.interfaceLang,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          updateCardWordTooltip(getText("error"), true);
          return;
        }
        if (!document.getElementById("qt-selection-card") || currentPanelHoveredWord !== wordData.word) {
          return;
        }
        if (response && response.translation) {
          updateCardWordTooltip(response.translation);
        } else if (response && response.error) {
          updateCardWordTooltip(response.error, true);
        } else {
          updateCardWordTooltip(getText("error"), true);
        }
      }
    );
  }, Math.min(settings.delay, 250));
}

function showCardWordTooltip(text, isError = false) {
  removeCardWordTooltip();
  const tooltip = document.createElement("div");
  tooltip.id = "qt-card-word-tooltip";
  tooltip.className = "qt-selection-ui";
  tooltip.innerText = text;
  if (isError) tooltip.classList.add("error");
  document.body.appendChild(tooltip);
  positionCardWordTooltip();
}

function updateCardWordTooltip(text, isError = false) {
  const tooltip = document.getElementById("qt-card-word-tooltip");
  if (!tooltip) return;
  tooltip.innerText = text;
  tooltip.classList.toggle("error", isError);
  positionCardWordTooltip();
}

function positionCardWordTooltip() {
  const tooltip = document.getElementById("qt-card-word-tooltip");
  if (!tooltip || !currentPanelWordRect) return;

  positionFloatingElement(tooltip, currentPanelWordRect, {
    offset: 8,
    placements: ["top", "bottom", "right", "left"],
    avoidRects: [currentPanelWordRect, ...getUiRects(["qt-card-word-tooltip"])],
  });
}

function clearPanelWordHover() {
  clearTimeout(panelWordTimer);
  panelWordTimer = null;
  currentPanelHoveredWord = "";
  currentPanelWordRect = null;
  removeCardWordTooltip();
}

function removeCardWordTooltip() {
  const tooltip = document.getElementById("qt-card-word-tooltip");
  if (tooltip) tooltip.remove();
}

function resetPageHover() {
  clearTimeout(hoverTimer);
  hoverTimer = null;
  currentHoveredWord = "";
  removeTooltip();
  removeHighlight();
}

function updateVisibleInterfaceText() {
  const selectionButton = document.getElementById("qt-selection-button");
  if (selectionButton) selectionButton.innerText = getText("translateButton");

  const arrowEl = document.querySelector("#qt-selection-card .qt-card-arrow");
  if (arrowEl) arrowEl.innerText = getText("translationLabel");

  const translatedEl = document.getElementById("qt-card-translated-text");
  if (translatedEl && translatedEl.dataset.state === "loading") {
    translatedEl.innerText = getText("translating");
  }
}

// --- Yardımcı Fonksiyonlar ---

// Kelimeyi VE konumunu (Range) döndüren fonksiyon — Unicode harf desteğiyle
// (örn. ç, ş, ğ, ü, ö, ı gibi Türkçe karakterler de kelimeye dahil edilir)
function getWordDataAtPoint(x, y) {
  let range;

  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos) return null;
    range = document.createRange();
    range.setStart(pos.offsetNode, pos.offset);
    range.setEnd(pos.offsetNode, pos.offset);
  } else if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  } else {
    return null;
  }

  if (!range || range.startContainer.nodeType !== Node.TEXT_NODE) return null;

  const text = range.startContainer.textContent;
  const offset = range.startOffset;

  const isWordChar = (ch) => !!ch && /[\p{L}\p{N}'-]/u.test(ch);

  if (!isWordChar(text[offset])) return null;

  let start = offset;
  while (start > 0 && isWordChar(text[start - 1])) start--;
  let end = offset;
  while (end < text.length && isWordChar(text[end])) end++;

  range.setStart(range.startContainer, start);
  range.setEnd(range.startContainer, end);

  const word = text.substring(start, end).trim();
  return word.length > 1 ? { word, range } : null;
}

function showHighlight(range) {
  removeHighlight();
  const rects = range.getClientRects();

  for (const rect of rects) {
    const highlight = document.createElement("div");
    highlight.className = "quick-translate-hover-highlight";
    highlight.style.left = `${rect.left + window.scrollX}px`;
    highlight.style.top = `${rect.top + window.scrollY}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
    document.body.appendChild(highlight);
  }
}

function removeHighlight() {
  document.querySelectorAll(".quick-translate-hover-highlight").forEach((h) => h.remove());
}

function showTooltip(x, y, text, isError = false) {
  removeTooltip();
  const tooltip = document.createElement("div");
  tooltip.id = "quick-translate-tooltip";
  tooltip.innerText = text;
  if (isError) tooltip.classList.add("error");

  currentTooltipAnchorRect = pointToRect(x, y);
  document.body.appendChild(tooltip);
  positionTooltip();
}

function updateTooltip(text, isError = false) {
  const tooltip = document.getElementById("quick-translate-tooltip");
  if (tooltip) {
    tooltip.innerText = text;
    tooltip.classList.toggle("error", isError);
    positionTooltip();
  }
}

function removeTooltip() {
  const tooltip = document.getElementById("quick-translate-tooltip");
  if (tooltip) tooltip.remove();
  currentTooltipAnchorRect = null;
}

function positionTooltip() {
  const tooltip = document.getElementById("quick-translate-tooltip");
  if (!tooltip || !currentTooltipAnchorRect) return;

  positionFloatingElement(tooltip, currentTooltipAnchorRect, {
    offset: 12,
    placements: ["right-bottom", "left-bottom", "right-top", "left-top"],
    avoidRects: getUiRects(["quick-translate-tooltip"]),
  });
}

function positionSelectionButton(button, selectionRect) {
  positionFloatingElement(button, selectionRect, {
    offset: 8,
    placements: ["top", "bottom", "right", "left"],
    avoidRects: getUiRects(["qt-selection-button"]),
  });
}

function positionFloatingElement(element, anchorRect, options = {}) {
  const offset = options.offset ?? 8;
  const margin = options.margin ?? 8;
  const placements = options.placements ?? ["bottom", "top", "right", "left"];
  const avoidRects = options.avoidRects ?? [];
  const elementRect = element.getBoundingClientRect();
  const width = elementRect.width;
  const height = elementRect.height;

  const candidates = placements.map((placement, index) => {
    const pos = getPlacementPosition(placement, anchorRect, width, height, offset);
    const clamped = {
      left: clamp(pos.left, margin, Math.max(margin, window.innerWidth - width - margin)),
      top: clamp(pos.top, margin, Math.max(margin, window.innerHeight - height - margin)),
    };
    const rect = {
      left: clamped.left,
      top: clamped.top,
      right: clamped.left + width,
      bottom: clamped.top + height,
    };
    const overlapPenalty = avoidRects.reduce((sum, avoidRect) => {
      return sum + getOverlapArea(rect, expandRect(avoidRect, 4));
    }, 0);

    return { ...clamped, index, overlapPenalty };
  });

  candidates.sort((a, b) => a.overlapPenalty - b.overlapPenalty || a.index - b.index);
  const best = candidates[0] || { left: margin, top: margin };
  element.style.left = `${best.left}px`;
  element.style.top = `${best.top}px`;
}

function getPlacementPosition(placement, anchorRect, width, height, offset) {
  const centerX = anchorRect.left + anchorRect.width / 2;
  const centerY = anchorRect.top + anchorRect.height / 2;

  switch (placement) {
    case "top":
      return { left: centerX - width / 2, top: anchorRect.top - height - offset };
    case "bottom":
      return { left: centerX - width / 2, top: anchorRect.bottom + offset };
    case "left":
      return { left: anchorRect.left - width - offset, top: centerY - height / 2 };
    case "right":
      return { left: anchorRect.right + offset, top: centerY - height / 2 };
    case "left-top":
      return { left: anchorRect.left - width - offset, top: anchorRect.top - height - offset };
    case "right-top":
      return { left: anchorRect.right + offset, top: anchorRect.top - height - offset };
    case "left-bottom":
      return { left: anchorRect.left - width - offset, top: anchorRect.bottom + offset };
    case "right-bottom":
    default:
      return { left: anchorRect.right + offset, top: anchorRect.bottom + offset };
  }
}

function pointToRect(x, y) {
  return { left: x, top: y, right: x, bottom: y, width: 0, height: 0 };
}

function getFirstVisibleRect(range) {
  const rects = Array.from(range.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
  return rects[0] || null;
}

function getUiRects(excludedIds = []) {
  return Array.from(document.querySelectorAll(".qt-selection-ui, #quick-translate-tooltip"))
    .filter((el) => !excludedIds.includes(el.id))
    .map((el) => el.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
}

function getOverlapArea(a, b) {
  const xOverlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const yOverlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return xOverlap * yOverlap;
}

function expandRect(rect, amount) {
  return {
    left: rect.left - amount,
    top: rect.top - amount,
    right: rect.right + amount,
    bottom: rect.bottom + amount,
    width: rect.width + amount * 2,
    height: rect.height + amount * 2,
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
