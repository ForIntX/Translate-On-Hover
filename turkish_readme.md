# 🔤 Translate On Hover

Web'de gezerken kelime veya cümleleri anında çevirin — sekme değiştirmeden,
kopyala-yapıştır yapmadan.

![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)
![License: MIT](https://img.shields.io/badge/License-MIT-green)
![Chrome](https://img.shields.io/badge/Chrome-Edge-yellow)

> **Chrome Web Store:** Yakında eklenecek. Şimdilik aşağıdaki adımlarla
> manuel olarak kurabilirsin.

> **Önemli:** Bu eklenti **hiçbir çeviri API'sine varsayılan olarak bağlı
> gelmez**. Kurduktan sonra çalışması için kendi API yapılandırmanızı
> ayarlardan yapıştırmanız gerekir. Aşağıda nasıl yapılacağı anlatılıyor.

## ✨ Özellikler

### 🟥 Kelime Hover Çevirisi
Herhangi bir kelimenin üzerine gel → kelime kırmızı bir çizgiyle vurgulanır →
kısa bir süre sonra küçük bir kutucukta çevirisi belirir.

### 🟦 Cümle / Metin Seçim Çevirisi
Fareyle bir cümle veya metin parçası seç → seçimin üstünde **"🌐 Çevir"**
butonu çıkar → tıkla → ekranda büyük, okunaklı bir kart içinde orijinal metin
ve çevirisi görünür.

### 🔌 Kendi API'nizi Bağlayın
Eklenti, çeviriyi nereden alacağını sabit kod içinde tutmaz. Ayarlar
panelindeki tek bir kutucuğa, kullanacağınız API'nin bilgilerini (URL,
header, body) JSON olarak yapıştırırsınız. Bu sayede:
- Hangi servisi kullandığınızı ve verilerinizin nereye gittiğini siz kontrol edersiniz.
- Kendi API key'inizle, kendi kullanım koşullarınıza/limitlerinize bağlı kalırsınız.
- Eklenti hiçbir hazır/gömülü API key'i içermez.

### ⚙️ Diğer Ayarlar
- Hedef dili değiştir (Türkçe, İngilizce, Almanca, Fransızca, İspanyolca, Rusça, Arapça, İtalyanca, Japonca)
- Eklentiyi aç/kapat
- Hover gecikme süresini ayarla

## 📦 Kurulum

1. Bu repoyu indir veya klonla:
   ```bash
   git clone https://github.com/ForIntX/Translate-On-Hover.git
   ```
2. Chrome'da `chrome://extensions` adresine git (Edge için `edge://extensions`).
3. Sağ üstten **"Geliştirici modu"**'nu aç.
4. **"Paketlenmemiş öğe yükle"** butonuna tıkla.
5. İndirdiğin `Translate-On-Hover` klasörünü seç.
6. Eklenti ikonuna tıkla ve **bir çeviri API'si ekle** (aşağıdaki bölüme bak).
   API eklenmeden çeviri çalışmaz.

## 🔧 Çeviri API'si Ekleme

Eklenti ikonuna tıkla → **"Çeviri API'si"** altındaki kutucuğa, kullanacağın
API'nin bilgilerini aşağıdaki formatta JSON olarak yapıştır → **Kaydet**'e
bas.

```json
{
  "url": "https://api.ornek.com/translate",
  "method": "POST",
  "headers": { "Authorization": "Bearer API_KEY_BURAYA" },
  "bodyTemplate": "{\"q\":\"{{text}}\",\"target\":\"{{targetLang}}\"}",
  "responsePath": "data.translations.0.translatedText"
}
```

Alanların anlamı:
- **url** — İstek atılacak adres. GET kullanan API'lerde `{{text}}` ve
  `{{targetLang}}` yer tutucularını URL'nin içine koyabilirsin.
- **method** — `GET` veya `POST`.
- **headers** — API key genelde burada gider (`Authorization`, `X-Api-Key`
  gibi).
- **bodyTemplate** — POST isteklerinde gönderilecek body. `{{text}}` ve
  `{{targetLang}}` otomatik olarak gerçek değerlerle değiştirilir.
- **responsePath** — API'nin döndürdüğü JSON içinde çevrilmiş metnin
  bulunduğu yol, nokta gösterimiyle (örn. `translations.0.text`).

Aşağıda birkaç gerçek servis için hazır, kopyala-yapıştır örnekler var.

### Ücretsiz / ücretsiz katmanı olan API'ler

**LibreTranslate** — açık kaynak, ücretsiz public instance veya kendi
sunucunda çalıştırabilirsin. Bazı public instance'lar API key istemez,
bazıları ücretsiz key veriyor ([libretranslate.com](https://libretranslate.com)).
```json
{
  "url": "https://libretranslate.com/translate",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "bodyTemplate": "{\"q\":\"{{text}}\",\"source\":\"auto\",\"target\":\"{{targetLang}}\",\"format\":\"text\",\"api_key\":\"API_KEY_BURAYA\"}",
  "responsePath": "translatedText"
}
```

**DeepL API Free** — aylık 500.000 karaktere kadar ücretsiz
([deepl.com/pro-api](https://www.deepl.com/pro-api), kayıt ve kredi kartı
gerekebilir ama Free planı ücretsizdir).
```json
{
  "url": "https://api-free.deepl.com/v2/translate",
  "method": "POST",
  "headers": { "Authorization": "DeepL-Auth-Key API_KEY_BURAYA" },
  "bodyTemplate": "{\"text\":[\"{{text}}\"],\"target_lang\":\"{{targetLang}}\"}",
  "responsePath": "translations.0.text"
}
```

**Google Cloud Translation API** — yeni hesaplara genelde ücretsiz kredi
tanımlanıyor, sonrasında kullanım bazlı ücretli
([cloud.google.com/translate](https://cloud.google.com/translate)).
```json
{
  "url": "https://translation.googleapis.com/language/translate/v2?key=API_KEY_BURAYA",
  "method": "POST",
  "headers": { "Content-Type": "application/json" },
  "bodyTemplate": "{\"q\":\"{{text}}\",\"target\":\"{{targetLang}}\",\"format\":\"text\"}",
  "responsePath": "data.translations.0.translatedText"
}
```

**MyMemory API** — günlük belirli bir karakter limitine kadar key'siz
ücretsiz kullanılabiliyor ([mymemory.translated.net](https://mymemory.translated.net)).
```json
{
  "url": "https://api.mymemory.translated.net/get?q={{text}}&langpair=en|{{targetLang}}",
  "method": "GET",
  "headers": {},
  "bodyTemplate": "",
  "responsePath": "responseData.translatedText"
}
```
> Not: Bu örnek kaynak dili `en` olarak sabitler. Farklı bir kaynak dilden
> çeviri yapmak için `langpair` değerini kendine göre düzenle.

## 🛠️ Nasıl Çalışır

**Kelime çevirisi:**
1. Fareyi bir kelimenin üzerine getir.
2. ~400ms (ayarlanabilir) bekle.
3. Çeviri kutucuğu kelimenin yanında belirir.

**Cümle çevirisi:**
1. Fareyle bir metni seç.
2. Çıkan "🌐 Çevir" butonuna tıkla.
3. Büyük kartta çeviriyi oku, × ile kapat.

## 📁 Proje Yapısı

```
Translate-On-Hover/
├── manifest.json     # Eklenti yapılandırması (Manifest V3)
├── background.js     # Service worker — kullanıcı tanımlı API'ye istek, cache + queue
├── content.js        # Hover algılama, vurgu, tooltip, seçim çevirisi
├── style.css          # Görsel stiller
├── popup.html/.js     # Ayar paneli + API JSON kutucuğu
└── icons/             # Eklenti ikonları
```

## ⚠️ Bilinen Sınırlamalar

- API yapılandırılmadan eklenti çeviri yapmaz; sadece kelime/cümle
  vurgulama ve UI çalışır.
- Service worker (Manifest V3) uyku moduna girerse bellekteki cache sıfırlanır.
- Çok uzun metin seçimlerinde (birkaç paragraf) bazı API'ler yanıt vermeyi
  reddedebilir; tasarım tek cümle/kısa paragraf kullanımı için optimize
  edilmiştir.
- `input`, `textarea` ve `contenteditable` alanlarında devre dışıdır (yazarken
  rahatsız etmemesi için).

## 🤝 Katkıda Bulunma

Pull request'ler ve issue'lar memnuniyetle karşılanır. Büyük değişiklikler
için önce bir issue açıp ne yapmak istediğini tartışmak iyi olur.

1. Repoyu fork'la
2. Bir özellik dalı oluştur (`git checkout -b ozellik/yeni-bir-sey`)
3. Değişikliklerini commit'le
4. Dalını push'la ve bir PR aç

## 📄 Lisans

MIT — detaylar için [LICENSE](LICENSE) dosyasına bak.

## ⚖️ Sorumluluk Reddi

Bu eklenti, herhangi bir çeviri API sağlayıcısı ile bağlantılı veya
onaylı değildir. Kullanıcılar, ayarlardan ekledikleri API'lerin kullanım
koşullarına ve API key güvenliğine kendileri dikkat etmelidir. Geliştiriciler,
kullanıcıların tercih ettiği üçüncü taraf API'lerin kullanımından doğacak
sonuçlardan sorumlu değildir.