# XAU Backtest Pro

Profesyonel XAUUSD forex backtest sistemi. Next.js + TradingView Lightweight Charts + Firebase.

## Özellikler

- 📊 TradingView Lightweight Charts ile profesyonel candlestick grafik
- ⏯️ Bar-bar ilerleme ve otomatik replay (0.5x – 10x hız)
- ✏️ Çizim araçları: Trend çizgisi, yatay/dikey çizgi, dikdörtgen, Fibonacci, ışın
- 📈 İşlem yönetimi: Long/Short aç, TP/SL belirle
- 💰 P&L hesaplama, R:R katsayısı, equity eğrisi
- 📋 İşlem geçmişi ve detaylı istatistikler
- 🔥 Firebase ile opsiyonel cloud senkronizasyon
- 🔐 Basit şifre koruması

## Kurulum

### 1. Bağımlılıkları Yükle

```bash
cd my-backtest-system
npm install
```

### 2. XAUUSD Verilerini Hazırla

**Seçenek A — Hemen başlamak için (sample data):**
```bash
node scripts/generate_sample_data.js
```

**Seçenek B — Gerçek Yahoo Finance verisi:**
```bash
pip install yfinance pandas
python scripts/download_data.py
```

### 3. Firebase Kurulumu (İsteğe Bağlı)

Firebase olmadan da çalışır — veriler localStorage'a kaydedilir.

Firebase kullanmak için:

1. [Firebase Console](https://console.firebase.google.com)'a git
2. Yeni proje oluştur
3. **Firestore Database** etkinleştir (test mode)
4. **Proje Ayarları → Web Uygulaması** ekle → config kopyala
5. `.env.local` dosyası oluştur:

```bash
cp .env.local.example .env.local
# .env.local içindeki değerleri Firebase config'inden doldur
```

Firestore güvenlik kuralları (`Rules` sekmesi):
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 4. Geliştirme Sunucusu

```bash
npm run dev
```

Tarayıcıda: `http://localhost:3000` — Şifre: **fatihdesteli**

## Vercel Deploy

### Yöntem 1 — Vercel CLI

```bash
npm i -g vercel
vercel login
vercel --prod
```

### Yöntem 2 — GitHub + Vercel

1. Projeyi GitHub'a push et
2. [vercel.com](https://vercel.com) → "New Project" → repo seç
3. Framework: **Next.js** (otomatik algılanır)
4. Environment Variables ekle (Firebase kullanıyorsan)
5. Deploy!

**Önemli:** `public/data/*.json` dosyaları GitHub'a push edilmeli!

---

## Klavye Kısayolları

| Tuş | Eylem |
|-----|-------|
| `→` | 1 bar ileri |
| `←` | 1 bar geri |
| `Shift + →` | 10 bar ileri |
| `Shift + ←` | 10 bar geri |
| `Space` | Oynat / Duraklat |

## Veri Bilgisi

| TF | Sample Veri |
|----|-------------|
| 1m | 10,080 bar |
| 5m | 8,640 bar |
| 15m | 5,760 bar |
| 1h | 4,380 bar |
| 4h | 2,000 bar |
| 1D | 1,000 bar |

## XAUUSD P&L Hesaplama

1 lot = 100 ons
- 0.1 lot, $1 hareket → $10 P&L
- 1.0 lot, $1 hareket → $100 P&L
