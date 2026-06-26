# 🔤 Translate On Hover

Instantly translate words or sentences as you browse the web — no tab
switching, no copy-pasting.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![License: MIT](https://img.shields.io/badge/License-MIT-green)
![Chrome](https://img.shields.io/badge/Chrome-Edge-yellow)

> **Chrome Web Store:** Coming soon. For now, you can install it manually
> using the steps below.

> **Important:** This extension **does not come connected to any
> translation API by default**. After installing, you need to paste your
> own API configuration in the settings for it to work. See how below.

## ✨ Features

### 🟥 Word Hover Translation
Hover over any word → the word gets underlined in red → shortly after, its
translation appears in a small box.

### 🟦 Sentence / Text Selection Translation
Select a sentence or piece of text with your mouse → a **"🌐 Translate"**
button appears above the selection → click it → a large, readable card
appears on screen showing the original text and its translation.

### 🔌 Connect Your Own API
The extension doesn't hard-code where translations come from. You paste
your API's details (URL, headers, body) as JSON into a single box in the
settings panel. This means:
- You control which service you use and where your data goes.
- You use your own API key, under your own usage terms and limits.
- The extension does not include any built-in/embedded API key.

### ⚙️ Other Settings
- Change the target language (Turkish, English, German, French, Spanish, Russian, Arabic, Italian, Japanese)
- Turn the extension on/off
- Adjust the hover delay

## 📦 Installation

1. Download or clone this repo:
   ```bash
   git clone https://github.com/ForIntX/Translate-On-Hover.git
   ```
2. Go to `chrome://extensions` in Chrome (`edge://extensions` for Edge).
3. Enable **"Developer mode"** in the top right.
4. Click **"Load unpacked"**.
5. Select the `Translate-On-Hover` folder you downloaded.
6. Click the extension icon and **add a translation API** (see the section
   below). Translation won't work until an API is configured.

## 🔧 Adding a Translation API

Click the extension icon → paste your API's details as JSON into the box
under **"Translation API"** → click **Save**.

```json
{
  "url": "https://api.example.com/translate",
  "method": "POST",
  "headers": { "Authorization": "Bearer YOUR_API_KEY_HERE" },
  "bodyTemplate": "{\"q\":\"{{text}}\",\"target\":\"{{targetLang}}\"}",
  "responsePath": "data.translations.0.translatedText"
}
```

Field reference:
- **url** — The endpoint to send the request to. For APIs that use GET, you
  can place the `{{text}}` and `{{targetLang}}` placeholders directly in the
  URL.
- **method** — `GET` or `POST`.
- **headers** — The API key usually goes here (`Authorization`, `X-Api-Key`,
  etc.).
- **bodyTemplate** — The body sent with POST requests. `{{text}}` and
  `{{targetLang}}` are automatically replaced with the real values.
- **responsePath** — The dot-notation path to the translated text inside the
  API's JSON response (e.g. `translations.0.text`).

Below are some ready-to-use, copy-paste examples for a few real services.

### Free / freemium APIs

**LibreTranslate** — open source; use a free public instance or run your
own server. Some public instances don't require an API key, others provide
a free key ([libretranslate.com](https://libretranslate.com)).
```json
{
  "url": "https://libretranslate.com/translate",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "bodyTemplate": "{\"q\":\"{{text}}\",\"source\":\"auto\",\"target\":\"{{targetLang}}\",\"format\":\"text\",\"api_key\":\"YOUR_API_KEY_HERE\"}",
  "responsePath": "translatedText"
}
```

**DeepL API Free** — free for up to 500,000 characters per month
([deepl.com/pro-api](https://www.deepl.com/pro-api); sign-up and a credit
card may be required, but the Free plan itself costs nothing).
```json
{
  "url": "https://api-free.deepl.com/v2/translate",
  "method": "POST",
  "headers": { "Authorization": "DeepL-Auth-Key YOUR_API_KEY_HERE" },
  "bodyTemplate": "{\"text\":[\"{{text}}\"],\"target_lang\":\"{{targetLang}}\"}",
  "responsePath": "translations.0.text"
}
```

**Google Cloud Translation API** — new accounts usually get free credit,
then it's pay-as-you-go
([cloud.google.com/translate](https://cloud.google.com/translate)).
```json
{
  "url": "https://translation.googleapis.com/language/translate/v2?key=YOUR_API_KEY_HERE",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "bodyTemplate": "{\"q\":\"{{text}}\",\"target\":\"{{targetLang}}\",\"format\":\"text\"}",
  "responsePath": "data.translations.0.translatedText"
}
```

**MyMemory API** — free to use without a key up to a daily character limit
([mymemory.translated.net](https://mymemory.translated.net)).
```json
{
  "url": "https://api.mymemory.translated.net/get?q={{text}}&langpair=en|{{targetLang}}",
  "method": "GET",
  "headers": {},
  "bodyTemplate": "",
  "responsePath": "responseData.translatedText"
}
```
> Note: This example hard-codes the source language as `en`. To translate
> from a different source language, adjust the `langpair` value accordingly.

## 🛠️ How It Works

**Word translation:**
1. Hover your mouse over a word.
2. Wait ~400ms (configurable).
3. A translation box appears next to the word.

**Sentence translation:**
1. Select a piece of text with your mouse.
2. Click the "🌐 Translate" button that appears.
3. Read the translation in the large card, close it with ×.

## 📁 Project Structure

```
Translate-On-Hover/
├── manifest.json     # Extension configuration (Manifest V3)
├── background.js     # Service worker — requests to user-defined API, cache + queue
├── content.js        # Hover detection, highlighting, tooltip, selection translation
├── style.css          # Visual styles
├── popup.html/.js     # Settings panel + API JSON box
└── icons/             # Extension icons
```

## ⚠️ Known Limitations

- The extension won't translate anything until an API is configured; only
  word/sentence highlighting and the UI work without one.
- The in-memory cache resets if the service worker (Manifest V3) goes to
  sleep.
- Some APIs may refuse to respond to very long text selections (several
  paragraphs); the design is optimized for single sentences/short
  paragraphs.
- Disabled inside `input`, `textarea`, and `contenteditable` fields (so it
  doesn't get in the way while typing).

## 🤝 Contributing

Pull requests and issues are welcome. For larger changes, it's a good idea
to open an issue first to discuss what you'd like to do.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/something-new`)
3. Commit your changes
4. Push your branch and open a PR

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

## ⚖️ Disclaimer

This extension is not affiliated with or endorsed by any translation API
provider. Users are responsible for the usage terms and API key security of
any third-party APIs they add through the settings. The developers are not
responsible for any consequences arising from the use of third-party APIs
chosen by users.