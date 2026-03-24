# Contact API — Kapsamlı Teknik Dokümantasyon

> **v2.0.0** · Node.js + Express · MySQL · cPanel / LiteSpeed uyumlu

---

## İçindekiler

1. [Genel Bakış](#1-genel-bakış)
2. [Mimari ve Klasör Yapısı](#2-mimari-ve-klasör-yapısı)
3. [Veritabanı Şeması](#3-veritabanı-şeması)
4. [Güvenlik Katmanları](#4-güvenlik-katmanları)
5. [Public API](#5-public-api)
6. [Admin API](#6-admin-api)
   - [Kimlik Doğrulama](#61-kimlik-doğrulama)
   - [Channel Yönetimi](#62-channel-yönetimi)
   - [Submission Yönetimi](#63-submission-yönetimi)
7. [Admin Panel (SPA)](#7-admin-panel-spa)
8. [Email Bildirim Sistemi](#8-email-bildirim-sistemi)
9. [Kurulum ve Yapılandırma](#9-kurulum-ve-yapılandırma)
10. [Ortam Değişkenleri (.env)](#10-ortam-değişkenleri-env)
11. [Veritabanı Migrasyonları](#11-veritabanı-migrasyonları)
12. [Kullanım Örnekleri (Frontend)](#12-kullanım-örnekleri-frontend)
13. [Blog Yorum, Beğeni & Bülten Sistemi](#13-blog-yorum-beğeni--bülten-sistemi)
   - [Genel Değerlendirme](#131-genel-değerlendirme)
   - [Mimari Karar](#132-mimari-kararı)
   - [Veritabanı Şeması](#133-veritabanı-şema-tasarımı)
   - [Avatar Sistemi](#134-avatar-sistemi)
   - [API Endpoint Tasarımı](#135-api-endpoint-tasarımı)
   - [Bülten Aboneliği](#136-bülten-aboneliği-double-opt-in)
   - [Rate Limiting](#137-rate-limiting-stratejisi)
   - [Güvenlik](#138-güvenlik-değerlendirmesi)
   - [Widget Kullanımı](#139-widget-kullanımı)

---

## 1. Genel Bakış

**Contact API**, birden fazla web sitesinin/projesinin form gönderilerini tek bir merkezi backend üzerinden yönetmesini sağlayan çok kanallı (multi-channel) bir iletişim formu API'sidir.

### Ne Yapabilir?

| Yetenek | Açıklama |
|---|---|
| **Multi-channel izolasyon** | Her proje kendi API anahtarıyla ayrı bir "channel"a veri gönderir |
| **Bot koruması** | Honeypot alanı + HMAC doğrulama tokeni ile otomatik spam filtreleme |
| **Rate limiting** | IP başına istek sınırı; form submit (10/dk) ve admin login (10/15dk) |
| **Email bildirimleri** | Yeni gönderiler channel'a atanmış e-posta adresine otomatik iletilir |
| **Admin paneli** | JWT korumalı SPA ile channel ve submission yönetimi |
| **CSV export** | Filtrelenmiş submission'ları Excel uyumlu CSV olarak indirme |
| **Health check** | `/health` endpointi ile servis canlılığı izleme |

---

## 2. Mimari ve Klasör Yapısı

```
contact-api/
├── index.js                  # Express uygulama giriş noktası, route bağlantıları
├── config/
│   └── db.js                 # MySQL bağlantı pool'u (mysql2/promise)
├── middleware/
│   ├── auth.js               # JWT doğrulama middleware'i
│   ├── honeypot.js           # Bot engelleme (honeypot alanı kontrolü)
│   └── rateLimit.js          # IP tabanlı istek sınırlama
├── routes/
│   ├── api.js                # POST /api/submit — genel form endpoint'i
│   ├── adminAuth.js          # POST /admin/api/auth/login, /change-password
│   ├── adminChannels.js      # CRUD /admin/api/channels
│   └── adminSubmissions.js   # CRUD + export /admin/api/submissions
├── workers/
│   └── notifier.js           # Cron ile çalışan email gönderim worker'ı
├── scripts/
│   ├── migrate.js            # SQL migration çalıştırıcı
│   └── seed-admin.js         # İlk admin kullanıcısı oluşturma
├── migrations/
│   ├── 001_notification_fields.sql
│   ├── 002_admins_table.sql
│   └── 003_channels_timestamps.sql
└── public/
    └── admin/                # Admin SPA (vanilla JS, istemci tarafı router)
```

### İstek Akışı

```
İstemci (Frontend)
      │
      ▼
POST /api/submit
      │
  [Rate Limiter]  ←── 10 istek/dakika/IP aşılırsa 429
      │
  [Honeypot]      ←── _hp alanı doluysa sessiz 200 döner
      │
  [API Key Doğrula] ←── channels tablosunda yoksa 403
      │
  [HMAC Token]    ←── TOKEN_SECRET varsa doğrular, geçersizse 400
      │
  MySQL INSERT (submissions)
      │
      ▼
  200 OK

──────────── Arka Planda ────────────
Cron Job (her 2 dk) → workers/notifier.js
      │
  notified=0 kayıtları çek
      │
  SMTP ile email gönder
      │
  notified=1 olarak işaretle
```

---

## 3. Veritabanı Şeması

> Canlı veritabanından alınan şema (audfllcd_contact_form)

### `channels` tablosu

| Kolon | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `id` | INT AUTO_INCREMENT | PK | Kanal kimliği |
| `channel_name` | VARCHAR(50) | EVET | Kanalın görünen adı (örn. "Portfolio Site") |
| `api_key` | VARCHAR(64) | EVET, UNİK | `ch_` önekli 48 karakterlik hex anahtar |
| `notification_email` | VARCHAR(255) | HAYIR | Bu kanalın bildirim alacağı e-posta adresi |
| `created_at` | TIMESTAMP | otomatik | Oluşturulma zamanı |

### `submissions` tablosu

| Kolon | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `id` | INT AUTO_INCREMENT | PK | Gönderi kimliği |
| `channel_id` | INT | EVET, FK | Hangi kanala ait olduğu |
| `form_data` | LONGTEXT (JSON) | EVET | Formdan gelen tüm alanlar (serbest yapı) |
| `ip_address` | VARCHAR(45) | HAYIR | Gönderen IP adresi |
| `is_verified` | TINYINT(1) | 0 | HMAC token geçtiyse 1 |
| `created_at` | TIMESTAMP | otomatik | Gönderim zamanı |
| `notified` | TINYINT(1) | 0 | Email gönderildi mi (0/1) |
| `notified_at` | DATETIME | HAYIR | Email gönderildiği zaman |

> **İndeksler:** `notified` (bildirim sorgularını hızlandırır), `(channel_id, created_at)` (filtreleme sorgularını hızlandırır)

### `admins` tablosu

| Kolon | Tip | Zorunlu | Açıklama |
|---|---|---|---|
| `id` | INT AUTO_INCREMENT | PK | Admin kimliği |
| `username` | VARCHAR(50) | EVET, UNİK | Giriş adı |
| `password_hash` | VARCHAR(255) | EVET | bcrypt hash (10 round) |
| `created_at` | DATETIME | otomatik | Oluşturulma zamanı |

---

## 4. Güvenlik Katmanları

### 4.1 Rate Limiting

İki ayrı sınırlayıcı çalışır:

| Endpoint | Pencere | Max İstek | Hata |
|---|---|---|---|
| `POST /api/submit` | 1 dakika | 10 | `429 Too Many Requests` |
| `POST /admin/api/auth/login` | 15 dakika | 10 | `429 Too Many Requests` |

Kural ihlalinde dönen yanıt:
```json
{ "error": "Çok fazla istek gönderildi. Lütfen biraz bekleyin." }
```

### 4.2 Honeypot (Bot Koruması)

Form verisi içindeki `_hp` alanı doluysa istek gerçek bir kullanıcıdan gelmiyor demektir. Bot işlemi fark etmesin diye `200 OK` döner ama **veri veritabanına kaydedilmez**.

Frontend entegrasyonu:
```html
<!-- Gizli honeypot alanı — CSS ile saklayın, ARIA ile erişilebilirlikten çıkarın -->
<input type="text" name="_hp" style="display:none" tabindex="-1" autocomplete="off">
```

### 4.3 HMAC Doğrulama Tokeni

`TOKEN_SECRET` ortam değişkeni tanımlıysa her form gönderisi bir `verification_token` içermek zorundadır.

**Token formatı:** `{timestamp}.{hmac_sha256_hash}`

Frontend üretimi:
```javascript
const timestamp = Date.now();
const hash = CryptoJS.HmacSHA256(timestamp + apiKey, TOKEN_SECRET).toString();
const token = `${timestamp}.${hash}`;
```

Token geçerlilik süresi: **5 dakika** (eski token reddedilir).

### 4.4 JWT Auth (Admin)

Tüm `/admin/api/channels` ve `/admin/api/submissions` endpoint'leri `Authorization: Bearer <token>` başlığı gerektirir.

- Token süresi: `JWT_EXPIRES` (varsayılan: 8 saat)
- Algoritma: HS256
- Payload: `{ id, username }`

### 4.5 CORS

İzin verilen origin'ler `.env` içindeki `ALLOWED_ORIGINS` değişkeninden okunur (virgülle ayrılmış liste). Liste boşsa tüm origin'lere izin verilir (geliştirme uyumluluğu).

---

## 5. Public API

### `POST /api/submit`

Form verisini kaydeder. **API anahtarı gerektiren tek public endpoint'tir.**

#### İstek Gövdesi

```json
{
  "api_key": "ch_abc123...",
  "verification_token": "1709550000000.abc123...",
  "data": {
    "name": "Ahmet Yılmaz",
    "email": "ahmet@ornek.com",
    "message": "Merhaba, bilgi almak istiyorum.",
    "_hp": ""
  }
}
```

| Alan | Zorunlu | Açıklama |
|---|---|---|
| `api_key` | EVET | Channel'a ait API anahtarı |
| `verification_token` | EVET | HMAC güvenlik tokeni (bkz. 4.3) |
| `data` | EVET | Formdan gelen serbest yapılı JSON nesnesi |
| `data._hp` | BOT'lar için | Honeypot alanı — boş gönderilmeli |

#### Başarılı Yanıt (`200 OK`)

```json
{ "success": "Mesajınız başarıyla kaydedildi." }
```

#### Hata Yanıtları

| Kod | Mesaj | Neden |
|---|---|---|
| `400` | Güvenlik doğrulaması tamamlanmadı | `verification_token` eksik |
| `400` | Güvenlik doğrulaması başarısız | HMAC eşleşmedi veya token süresi doldu |
| `403` | Geçersiz API Anahtarı | `api_key` veritabanında bulunamadı |
| `429` | Çok fazla istek | Rate limit aşıldı |
| `500` | Sunucu tarafında bir hata oluştu | DB hatası |

---

## 6. Admin API

Tüm admin endpoint'leri `/admin/api/` altındadır. Login hariç tüm istekler JWT token gerektirir.

### 6.1 Kimlik Doğrulama

#### `POST /admin/api/auth/login`

```json
// İstek
{ "username": "admin", "password": "şifreniz" }

// Başarılı Yanıt (200)
{ "token": "eyJhbGc...", "username": "admin" }

// Hata (401)
{ "error": "Geçersiz kullanıcı adı veya şifre." }
```

#### `POST /admin/api/auth/change-password`

> JWT token gerektirir.

```json
// İstek
{ "currentPassword": "eskiŞifre", "newPassword": "yeniŞifre123" }

// Başarılı Yanıt (200)
{ "success": "Şifre başarıyla değiştirildi." }
```

Kural: `newPassword` en az 6 karakter olmalıdır.

---

### 6.2 Channel Yönetimi

> Tüm endpoint'ler `Authorization: Bearer <token>` gerektirir.

#### `GET /admin/api/channels`

Tüm kanalları listeler.

```json
// Yanıt (200)
[
  {
    "id": 1,
    "channel_name": "Portfolio Site",
    "api_key": "ch_a1b2c3...",
    "notification_email": "info@ornek.com",
    "created_at": "2026-01-15T10:00:00.000Z"
  }
]
```

#### `POST /admin/api/channels`

Yeni kanal oluşturur. API anahtarı otomatik üretilir (`ch_` + 48 hex karakter).

```json
// İstek
{ "channel_name": "Yeni Site", "notification_email": "yeni@ornek.com" }

// Yanıt (201)
{
  "id": 2,
  "channel_name": "Yeni Site",
  "api_key": "ch_f4e5d6...",
  "notification_email": "yeni@ornek.com"
}
```

#### `PUT /admin/api/channels/:id`

Kanal adını veya bildirim email'ini günceller.

```json
// İstek
{ "channel_name": "Güncel İsim", "notification_email": "yeni@mail.com" }

// Yanıt (200)
{ "success": "Channel güncellendi." }
```

#### `POST /admin/api/channels/:id/regenerate-key`

Mevcut API anahtarını iptal ederek yeni bir anahtar üretir.

```json
// Yanıt (200)
{ "api_key": "ch_x9y8z7..." }
```

---

### 6.3 Submission Yönetimi

> Tüm endpoint'ler `Authorization: Bearer <token>` gerektirir.

#### `GET /admin/api/submissions`

Filtrelenmiş ve sayfalanmış submission listesi döner.

**Query Parametreleri:**

| Parametre | Tip | Açıklama |
|---|---|---|
| `channel_id` | number | Belirli bir kanala filtrele |
| `from` | string (YYYY-MM-DD) | Başlangıç tarihi |
| `to` | string (YYYY-MM-DD) | Bitiş tarihi (o gün 23:59:59'a kadar dahil) |
| `notified` | 0 \| 1 | Bildirim durumuna göre filtrele |
| `keyword` | string | `form_data` içinde tam metin arama |
| `page` | number | Sayfa numarası (varsayılan: 1) |
| `limit` | number | Sayfa başı kayıt (varsayılan: 50) |

```
GET /admin/api/submissions?channel_id=1&from=2026-01-01&notified=0&page=1&limit=20
```

**Yanıt:**

```json
{
  "data": [
    {
      "id": 42,
      "channel_id": 1,
      "channel_name": "Portfolio Site",
      "form_data": { "name": "Ali", "email": "ali@mail.com", "message": "..." },
      "name": "Ali",
      "email": "ali@mail.com",
      "message": "...",
      "ip_address": "1.2.3.4",
      "is_verified": 1,
      "notified": 0,
      "notified_at": null,
      "created_at": "2026-03-01T14:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

#### `GET /admin/api/submissions/export`

Filtrelenmiş submission'ları **CSV** olarak indirir. Aynı filtre parametrelerini destekler (`channel_id`, `from`, `to`, `notified`, `keyword`).

- Yanıt başlığı: `Content-Type: text/csv; charset=utf-8`
- Dosya adı: `submissions_export.csv`
- Excel uyumluluğu için UTF-8 BOM eklenir

CSV sütunları: `ID, Channel, Name, Email, Message, IP, Notified, Created At`

#### `GET /admin/api/submissions/:id`

Tek bir submission'ın tam detayını döner (tüm `form_data` alanları dahil).

```json
{
  "id": 42,
  "channel_id": 1,
  "channel_name": "Portfolio Site",
  "form_data": { "name": "Ali", "email": "ali@mail.com", "subject": "İş Teklifi", "message": "..." },
  "ip_address": "1.2.3.4",
  "is_verified": 1,
  "notified": 1,
  "notified_at": "2026-03-01T14:05:00.000Z",
  "created_at": "2026-03-01T14:00:00.000Z"
}
```

#### `PUT /admin/api/submissions/:id/notify`

Submission'ı manuel olarak "bildirildi" olarak işaretler (örn. bildirim maili başarısız olduysa).

```json
// Yanıt (200)
{ "success": "Bildirim durumu güncellendi." }
```

---

## 7. Admin Panel (SPA)

`/admin` adresi altında çalışan, vanilla JavaScript ile yazılmış tek sayfalı uygulama (SPA).

### Sayfalar

| Sayfa | Rota | Yetenek |
|---|---|---|
| **Giriş** | `/admin/login` | Kullanıcı adı/şifre ile JWT token alımı |
| **Dashboard** | `/admin/` | Özet istatistikler |
| **Channels** | `/admin/channels` | Kanal listeleme, oluşturma, düzenleme, API key yenileme |
| **Submissions** | `/admin/submissions` | Filtreleme, arama, detay görüntüleme, CSV indirme |

### Kullanılan Dosyalar

```
public/admin/
├── index.html           # SPA shell
└── js/
    ├── app.js           # Uygulama başlatıcı
    ├── api.js           # Tüm API çağrıları (fetch wrapper)
    ├── auth.js          # Token saklama ve yönetimi
    ├── router.js        # Hash tabanlı istemci yönlendirme
    ├── components.js    # Paylaşılan UI bileşenleri
    └── pages/
        ├── login.js
        ├── dashboard.js
        ├── channels.js
        └── submissions.js
```

### SPA Fallback

Tüm `/admin/*` istekleri (API çağrıları hariç) `index.html`'e yönlendirilir. Sayfa yenilenmesi veya doğrudan URL girişi sorunsuz çalışır.

---

## 8. Email Bildirim Sistemi

### Nasıl Çalışır?

`workers/notifier.js` bir cron job tarafından düzenli aralıklarla çalıştırılır. Her çalışmada:

1. `notified = 0` olan en eski 10 kaydı alır
2. Her kayıt için channel'ın `notification_email` adresine (ya da `ADMIN_EMAIL` fallback'ine) e-posta gönderir
3. Başarılı gönderilerde `notified = 1`, `notified_at = NOW()` olarak günceller
4. Başarısız gönderimler `notified = 0` olarak kalır ve bir sonraki çalışmada tekrar denenir

### Cron Kurulumu (cPanel)

```
*/2 * * * * cd /home/kullanici/contact-api && /usr/bin/node workers/notifier.js >> /home/kullanici/contact-api/logs/notifier.log 2>&1
```

### E-Posta Şablonu

HTML e-posta şablonu aşağıdaki alanları içerir:

| Alan | Kaynak (form_data'dan çözülür) |
|---|---|
| Ad | `name` \| `fullName` \| `ad` |
| Email | `email` \| `mail` \| `eposta` |
| Mesaj | `message` \| `mesaj` \| `note` |
| Ekstra alanlar | Yukarıdakiler dışındaki tüm form alanları tablo olarak eklenir |
| IP | `ip_address` kolonu |
| Tarih | `created_at` kolonu |

---

## 9. Kurulum ve Yapılandırma

### Gereksinimler

- Node.js >= 16
- MySQL 5.7+ veya MariaDB 10.3+

### Adımlar

```bash
# 1. Bağımlılıkları yükle
npm install

# 2. Ortam dosyasını oluştur
cp .env.example .env
# .env içini doldurun (bkz. Bölüm 10)

# 3. Veritabanı migrasyonlarını çalıştır
npm run migrate

# 4. İlk admin kullanıcısını oluştur
npm run seed-admin -- admin GüçlüŞifre123

# 5. Uygulamayı başlat
npm start
```

---

## 10. Ortam Değişkenleri (.env)

```env
# Uygulama
PORT=3100

# Veritabanı
DB_HOST=127.0.0.1
DB_USER=db_kullanici
DB_PASSWORD=db_sifre
DB_NAME=db_adi

# Güvenlik
JWT_SECRET=cok_gizli_bir_deger_degistirin
JWT_EXPIRES=8h
TOKEN_SECRET=hmac_icin_gizli_anahtar        # Boş bırakılırsa HMAC doğrulama devre dışı
ALLOWED_ORIGINS=https://sitem.com,https://diger.com  # Boş bırakılırsa herkese açık

# SMTP (Email Bildirimleri)
SMTP_HOST=mail.sitem.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=bildirim@sitem.com
SMTP_PASS=smtp_sifre
SMTP_FROM=bildirim@sitem.com
ADMIN_EMAIL=admin@sitem.com                  # Kanal e-postası yoksa fallback

# Widget / Bülten
APP_URL=https://api.sitem.com                # Doğrulama e-postasındaki link tabanı
```

---

## 11. Veritabanı Migrasyonları

| Dosya | Açıklama |
|---|---|
| `001_notification_fields.sql` | `submissions` tablosuna `notified`, `notified_at`; `channels` tablosuna `notification_email` eklendi. Performans indeksleri oluşturuldu. |
| `002_admins_table.sql` | `admins` tablosu oluşturuldu (bcrypt şifre depolama). |
| `003_channels_timestamps.sql` | `channels` tablosuna `created_at` eklendi. |
| `004_comments_table.sql` | `comments` tablosu oluşturuldu (`avatar_id` dahil). |
| `005_reactions_table.sql` | `reactions` tablosu oluşturuldu (fingerprint UPSERT). |
| `006_subscribers_table.sql` | `subscribers` tablosu oluşturuldu (double opt-in bülten sistemi). |

```bash
npm run migrate
```

---

## 12. Kullanım Örnekleri (Frontend)

### Temel Form Entegrasyonu

```html
<form id="contactForm">
  <input name="name" placeholder="Adınız" required>
  <input name="email" type="email" placeholder="E-posta" required>
  <textarea name="message" placeholder="Mesajınız" required></textarea>
  <!-- Honeypot: kullanıcıdan gizle -->
  <input type="text" name="_hp" style="display:none" tabindex="-1">
  <button type="submit">Gönder</button>
</form>
```

### JavaScript ile Gönderim

```javascript
const API_KEY = 'ch_sizin_api_anahtariniz';
const API_URL = 'https://api.sitem.com/api/submit';

document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  // Basit token (TOKEN_SECRET kullanılmıyorsa rastgele değer yeterli)
  const token = `${Date.now()}.placeholder`;

  const payload = {
    api_key: API_KEY,
    verification_token: token,
    data: {
      name: form.name.value,
      email: form.email.value,
      message: form.message.value,
      _hp: form._hp.value   // boş olmalı
    }
  };

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();
    if (res.ok) {
      alert('Mesajınız gönderildi!');
      form.reset();
    } else {
      alert('Hata: ' + result.error);
    }
  } catch (err) {
    alert('Bağlantı hatası.');
  }
});
```

### HMAC Token Üretimi (TOKEN_SECRET kullanılıyorsa)

```javascript
// CryptoJS ile (CDN: https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/hmac-sha256.min.js)
const timestamp = Date.now();
const hash = CryptoJS.HmacSHA256(String(timestamp) + API_KEY, TOKEN_SECRET).toString();
const verificationToken = `${timestamp}.${hash}`;
```

### Admin API Örneği

```javascript
// Login
const { token } = await fetch('/admin/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'şifre' })
}).then(r => r.json());

// Submission listesi
const { data, pagination } = await fetch('/admin/api/submissions?page=1&limit=20', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// CSV indir
window.location.href = `/admin/api/submissions/export?channel_id=1&Authorization=${token}`;
// Not: Gerçek uygulamada token query string yerine header'da taşınmalıdır.
// CSV için Blob + a.download yöntemi tercih edilir.
```

---

## Health Check

```
GET /health

Yanıt:
{ "status": "ok", "timestamp": "2026-03-04T12:00:00.000Z" }
```

---

*Bu dokümantasyon canlı veritabanı şeması ve kaynak kodu analiz edilerek oluşturulmuştur (Mart 2026).*

---

## 13. Blog Yorum, Beğeni & Bülten Sistemi

> Bu bölüm, mevcut contact-api altyapısı üzerine inşa edilmiş blog yorum, clap ve bülten abonelik sistemini belgelemektedir. Mart 2026.

### 13.1 Genel Değerlendirme

Mevcut sistem zaten şunlara sahip:

| Mevcut Altyapı | Blog Sistemi İçin Karşılığı |
|---|---|
| `channels` — çok kiracılı izolasyon | Her makale bir "channel" olarak modellenebilir |
| `submissions` — serbest JSON depolama | Yorum verisi zaten bu yapıya sığar |
| Rate limiting middleware | Spam yorum / clap flooding'e karşı doğrudan kullanılabilir |
| Honeypot middleware | Bot'lardan gelen yorum spam'ını engeller |
| Admin paneli | Yorum moderasyon ekranı eklenebilir |
| Email notification worker | Yeni yorum bildirimi için yeniden kullanılabilir |

**Sonuç:** Mevcut altyapı, ek bir mikro-servis kurmaksızın bu özelliği destekleyebilecek kapasitededir. İki yeni tablo ve birkaç yeni route yeterlidir.

---

### 13.2 Mimari Kararı: Mevcut Tablolara Ekleme mi, Yeni Tablolar mı?

#### Seçenek A — `submissions` tablosunu yeniden kullanmak

`channel` türünü "yorum kanalı" olarak işaretleyip mevcut `submissions` yapısına yorum yazmak mümkündür. `form_data` JSON'una `type: "comment"`, `article_slug`, `author_name` vb. alanlar eklenir.

**Avantajlar:** Sıfır migration, mevcut admin paneli direkt çalışır.  
**Dezavantajlar:** Yorum sayısı sorguları performanslı olmaz; clap sistemi hiç modellenemez; moderasyon durumu (`approved/rejected`) `form_data` içinde gömülü kalır; public GET endpoint açmak için mevcut route'ları kırmak gerekir.

#### Seçenek B — İki yeni tablo (önerilen) ✅

```
comments   — yorum içeriği, onay durumu, makale slug'ı
reactions  — clap / like sayacı, IP + fingerprint bazlı tekil kontrol
```

**Avantajlar:** Temiz veri modeli; index'lenebilir sorgular; clap iş mantığı ayrı tutulur; `submissions` tablosu bozulmaz; Admin'e bağımsız "Yorumlar" sekmesi eklenebilir.  
**Dezavantajlar:** İki yeni migration dosyası gerektirir.

**Karar: Seçenek B.** Performans ve genişletilebilirlik açısından doğru yoldur.

---

### 13.3 Veritabanı Şema Tasarımı

#### `comments` tablosu

```sql
CREATE TABLE comments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  article_slug  VARCHAR(255)   NOT NULL,          -- makale URL slug'ı (örn. "nextjs-tips")
  channel_id    INT            NOT NULL,           -- hangi portfolio sitesi (FK → channels.id)
  author_name   VARCHAR(100)   NOT NULL DEFAULT 'Anonim',
  author_email  VARCHAR(255)   NULL,               -- bildirim için, kullanıcıya gösterilmez
  content       TEXT           NOT NULL,
  avatar_id     TINYINT        NULL DEFAULT NULL,  -- 1-8 arası; NULL = default avatar
  ip_address    VARCHAR(45)    NULL,
  status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_comments_slug    (article_slug),
  INDEX idx_comments_status  (article_slug, status),
  INDEX idx_comments_channel (channel_id),

  CONSTRAINT fk_comments_channel FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

> `article_slug` ile sorgulama merkezi tasarım kararıdır. `article_id` (integer) yerine slug kullanmak, frontend'in veritabanı ID'sini bilmeden sadece URL yoluyla içerik oluşturmasına olanak tanır.

#### `reactions` tablosu

```sql
CREATE TABLE reactions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  article_slug  VARCHAR(255)   NOT NULL,
  channel_id    INT            NOT NULL,
  reaction_type VARCHAR(20)    NOT NULL DEFAULT 'clap',  -- 'clap', 'like', 'heart' vb.
  fingerprint   VARCHAR(64)    NOT NULL,  -- IP + User-Agent karışımının SHA-256'sı
  count         TINYINT        NOT NULL DEFAULT 1,       -- Medium gibi: 1 kişi 50 clap verebilir
  created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_reaction (article_slug, channel_id, reaction_type, fingerprint),
  INDEX idx_reaction_slug (article_slug, reaction_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

> `fingerprint` = `SHA-256(ip + userAgent)`. Oturum gerektirmeden tekil kullanıcı tespiti; tamamen anonim ve KVKK/GDPR uyumludur.

#### `subscribers` tablosu

```sql
CREATE TABLE subscribers (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  channel_id          INT            NOT NULL,
  email               VARCHAR(255)   NOT NULL,
  status              ENUM('pending','active','unsubscribed') NOT NULL DEFAULT 'pending',
  verify_token        VARCHAR(64)    NULL,                -- double opt-in doğrulama tokeni
  verify_expires_at   DATETIME       NULL,                -- 24 saat geçerli
  source_slug         VARCHAR(255)   NULL,                -- hangi makaleden abone oldu
  created_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at         DATETIME       NULL,
  unsubscribed_at     DATETIME       NULL,

  UNIQUE KEY uq_subscriber (channel_id, email),
  INDEX idx_sub_status  (channel_id, status),
  INDEX idx_sub_token   (verify_token),

  CONSTRAINT fk_subscribers_channel FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

---

### 13.4 Avatar Sistemi

Yorumlar anonim olsa da kullanıcılar **8 hazır avatar** arasından seçim yapabilir ve **takma ad** belirleyebilir. Email veya kayıt gerektirmez.

| Alan | Tip | Açıklama |
|---|---|---|
| `avatar_id` | TINYINT (1-8) | Seçilen avatar numarası; NULL = default avatar |
| `author_name` | VARCHAR(100) | Kullanıcı tarafından girilen takma ad; boş ise "Anonim" |

**Dosya yapısı:**

```
public/widget/avatars/
├── avatar-1.svg   ←  kullanıcı seçer
├── avatar-2.svg
├── ...
├── avatar-8.svg
└── default.svg    ←  avatar_id NULL olduğunda
```

> Görseller repo'ya dahil **değildir**; `public/widget/avatars/README.md` dosyasında kaynak önerileri mevcuttur. Sen yerleştirirsin, widget otomatik kullanır.

---

### 13.5 API Endpoint Tasarımı

Tüm public comment/reaction endpoint'leri `/api/` altında açılır ve mevcut `api_key` + rate limiter altyapısını kullanır:

#### Public Endpoints (API key gerektirir)

| Method | Path | Açıklama |
|---|---|---|
| `GET` | `/api/comments/:slug` | Belirli makalenin onaylı yorumlarını listeler |
| `POST` | `/api/comments` | Yeni yorum gönderir (pending olarak kaydedilir) |
| `GET` | `/api/reactions/:slug` | Makalenin toplam clap sayısını ve tiplerini döner |
| `POST` | `/api/reactions` | Clap/like ekler veya günceller (fingerprint ile tekil) |
| `POST` | `/api/subscribe` | Bülten aboneliği başlatır (double opt-in maili gönderir) |
| `GET` | `/api/subscribe/verify?token=` | E-posta doğrulama linki — aboneliği aktive eder |
| `GET` | `/api/unsubscribe?token=` | E-postadaki çıkış linki |

#### Admin Endpoints (JWT gerektirir)

| Method | Path | Açıklama |
|---|---|---|
| `GET` | `/admin/api/comments` | Filtreli yorum listesi (status, slug, channel_id) |
| `GET` | `/admin/api/comments/:id` | Tek yorum detayı |
| `PUT` | `/admin/api/comments/:id/approve` | Yorumu onayla |
| `PUT` | `/admin/api/comments/:id/reject` | Yorumu reddet |
| `DELETE` | `/admin/api/comments/:id` | Yorumu sil |
| `GET` | `/admin/api/reactions/stats` | Makale bazlı clap istatistikleri |
| `GET` | `/admin/api/reactions` | Ham reaction listesi (sayfalı) |
| `GET` | `/admin/api/subscribers` | Bülten aboneleri listesi |
| `GET` | `/admin/api/subscribers/export` | Aktif aboneleri CSV olarak indir |
| `DELETE` | `/admin/api/subscribers/:id` | Aboneyi sil |

#### `GET /api/comments/:slug`

```
GET /api/comments/nextjs-tips?api_key=ch_abc123
```

```json
{
  "article_slug": "nextjs-tips",
  "total": 3,
  "comments": [
    {
      "id": 12,
      "author_name": "Ayşe K.",
      "content": "Çok faydalı bir yazı, teşekkürler!",
      "created_at": "2026-03-01T09:00:00.000Z"
    }
  ]
}
```

> `author_email` ve `ip_address` hiçbir zaman public yanıtta yer almaz.

#### `POST /api/comments`

```json
// İstek
{
  "api_key": "ch_abc123",
  "article_slug": "nextjs-tips",
  "data": {
    "author_name": "Mehmet Y.",
    "author_email": "mehmet@ornek.com",
    "content": "Harika bir makale!",
    "_hp": ""
  }
}

// Yanıt (201)
{ "success": "Yorumunuz incelemeye alındı.", "id": 42 }
```

Yorum doğrudan yayınlanmaz; `status = 'pending'` olarak kaydedilir. Admin onayından sonra görünür olur. Bu akış mevcut honeypot middleware'i ile doğrudan uyumludur.

#### `GET /api/reactions/:slug`

```json
{
  "article_slug": "nextjs-tips",
  "reactions": {
    "clap": 148,
    "like": 32
  },
  "user_reaction": {
    "clap": 5
  }
}
```

`user_reaction` alanı fingerprint ile eşleşen kullanıcının kendi sayısını gösterir; böylece frontend "zaten kaç clap verdin" durumunu bilebilir.

#### `POST /api/reactions`

```json
// İstek
{
  "api_key": "ch_abc123",
  "article_slug": "nextjs-tips",
  "reaction_type": "clap",
  "count": 3   // kullanıcı bu etkileşimde 3 clap verdi (kümülatif, max 50)
}

// Yanıt (200)
{ "total_claps": 151, "your_claps": 8 }
```

**İş Mantığı:** Bir `fingerprint` için maksimum `count` 50 olarak sınırlandırılır. `UPSERT` ile mevcut kayıt güncellenebilir:

```sql
INSERT INTO reactions (article_slug, channel_id, reaction_type, fingerprint, count)
VALUES (?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  count = LEAST(count + VALUES(count), 50),
  updated_at = NOW();
```

---

### 13.6 Bülten Aboneliği (Double Opt-in)

Clap anonim kalır; email toplamak için ayrı, izinli bir kanal olan bülten aboneliği sistemi kullanılır.

#### Akış

```
Kullanıcı email girer (widget'taki mini form)
        │
POST /api/subscribe  ←── honeypot + rate limit
        │
   Pending kayıt → doğrulama maili gönder
        │
GET /api/subscribe/verify?token=...  ←── e-postadaki link
        │
   Status: active ✅
        │
Admin panelde gözükür, CSV export alınabilir
```

#### Endpoint'ler

| Method | Path | Açıklama |
|---|---|---|
| `POST` | `/api/subscribe` | Abonelik başlat; body: `{ api_key, email, source_slug? }` |
| `GET` | `/api/subscribe/verify?token=` | Double opt-in onay linki |
| `GET` | `/api/unsubscribe?token=` | E-postadaki tek tıklama çıkış linki |

#### `POST /api/subscribe` Örneği

```json
// İstek
{
  "api_key": "ch_abc123",
  "email": "okuyucu@mail.com",
  "source_slug": "nextjs-tips"  // hangi makaleden abone oldu
}

// Yanıt (200) — e-posta enum'ından korunmak için her durumda aynı mesaj
{ "success": "Abonelik isteği alındı. Lütfen e-postanızı kontrol edin." }
```

#### `.env` Gereksinimi

`APP_URL` değişkeni doğrulama mailindeki link için kullanılır:

```env
APP_URL=https://api.sitem.com
```

---

### 13.7 Rate Limiting Stratejisi

`middleware/rateLimit.js`'e üç yeni sınırlayıcı eklendi (mevcut `submitLimiter` + `loginLimiter`'a ek):

```javascript
// Yorum gönderme: IP başına 5 yorum / saat
const commentLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5,
  message: { error: 'Çok fazla yorum gönderildi. Bir saat sonra tekrar deneyin.' }
});

// Clap / reaction: IP başına 200 etkileşim / saat
const reactionLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 200,
  message: { error: 'Çok fazla etkileşim. Bir saat sonra tekrar deneyin.' }
});

// Bülten aboneliği: IP başına 5 istek / saat
const subscribeLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5,
  message: { error: 'Çok fazla istek. Bir saat sonra tekrar deneyin.' }
});
```

| Endpoint | Pencere | Max | Limiter |
|---|---|---|---|
| `POST /api/submit` | 1 dk | 10 | `submitLimiter` |
| `POST /admin/api/auth/login` | 15 dk | 10 | `loginLimiter` |
| `POST /api/comments` | 1 saat | 5 | `commentLimiter` |
| `POST /api/reactions` | 1 saat | 200 | `reactionLimiter` |
| `POST /api/subscribe` | 1 saat | 5 | `subscribeLimiter` |

---

### 13.8 Güvenlik Değerlendirmesi

| Risk | Mevcut Koruma | Ek Önlem |
|---|---|---|
| Yorum spam (botlar) | Honeypot middleware ✅ | Content uzunluk minimum (10 karakter) |
| Clap flooding | Rate limiter + fingerprint UNIQUE key ✅ | Max 50/kişi iş kuralı |
| XSS (yorum içeriği) | Şu an mevcut değil ⚠️ | Backend'de HTML escape; frontend'de `textContent` kullan |
| Email harvestinig | `author_email` public API'de gizlenir ✅ | — |
| Müstehcen içerik | Şu an mevcut değil ⚠️ | Pending moderasyon akışı bunu yönetir |
| CORS | `ALLOWED_ORIGINS` ile kısıtlama ✅ | Portfolio domain'i listeye eklenir |

**XSS için en kritik kural:** Public `GET /api/comments/:slug` yanıtında `content` alanını hiçbir zaman `innerHTML` ile render etmeyin. Vanilla JS'de `element.textContent = comment.content` veya çerçeve içinde `{comment.content}` (React, Vue otomatik escape eder).

---

### 13.9 Widget Kullanımı

`public/widget/engage.js` — auto-init embed script. Tek `<script>` etiketi ile entegre edilir.

#### Entegrasyon

```html
<!-- Makale sayfasının altına eklenecek fragment -->
<div id="blog-engage"
     data-api="https://api.siteniz.com"
     data-key="ch_abc123"
     data-slug="nextjs-tips">
</div>
<script src="https://api.siteniz.com/widget/engage.js" defer></script>
```

#### Widget Dosya Yapısı

```
public/widget/
├── engage.js          # Tüm mantık tek dosyada; auto-init, API çağrıları, render
├── engage.css         # CSS custom properties ile özelleştirilebilir stiller
└── avatars/
    ├── avatar-1.svg   # ... avatar-8.svg  (sen yerleştirirsin)
    ├── default.svg    # avatar_id NULL iken gösterilir
    └── README.md      # kaynak önerileri
```

#### CSS Özelleştirme

Widget'ın tüm renk ve boyut değerleri CSS custom properties ile değiştirilebilir:

```css
#blog-engage {
  --eg-accent: #2563eb;        /* buton rengi */
  --eg-accent-hover: #1d4ed8;
  --eg-font: 'Inter', sans-serif;
  --eg-radius: 8px;
}
```

#### Render Edilen Arayüz

```
┌─────────────────────────────────────────────────┐
│  👏 148  [alkışla]  Senin: 5                    │
├─────────────────────────────────────────────────┤
│  💬 3 Yorum                                     │
│                                                 │
│  [avatar]  Ayşe K. · 1 Mart 2026               │
│            "Çok faydalı bir yazı!"              │
│                                                 │
│  [avatar]  Mehmet Y. · 28 Şubat 2026           │
│            "Next.js konusunu çok iyi anlattı."  │
│                                                 │
│  ─ Yorum Bırak ─────────────────────────────   │
│  [av1][av2][av3][av4][av5][av6][av7][av8]       │
│  Takma ad (isteğe): [__________________]        │
│  E-posta (gizli):   [__________________]        │
│  Yorum:             [__________________]        │
│                 0/2000        [Yorum Gönder]    │
├─────────────────────────────────────────────────┤
│  💌 Yeni yazılardan haberdar ol                 │
│  [e-posta@mail.com__________]  [Abone Ol]       │
└─────────────────────────────────────────────────┘
```

#### Clap Debounce Mantığı

Tıklamalar 800ms debounce ile birleştirilir; tek API çağrısında toplu gönderilir (Medium tarzı):

```javascript
// engage.js içinden — burst tıklamaları birleştir
pendingClaps++;
clearTimeout(debounceTimer);
debounceTimer = setTimeout(() => {
  fetch('/api/reactions', { method: 'POST', body: JSON.stringify({
    api_key, article_slug, reaction_type: 'clap', count: pendingClaps
  })});
  pendingClaps = 0;
}, 800);
```

---

### 13.10 Moderasyon Akışı

```
Kullanıcı yorum gönderir
        │
   status = 'pending'
        │
   Email bildirimi → admin
   (notifier worker mevcut altyapısı genişletilebilir)
        │
   Admin paneli → Yorumlar sekmesi
        │
   ┌────┴────┐
   │ Onayla  │  Reddet
   │         │
status=      status=
'approved'  'rejected'
   │
   └─ GET /api/comments/:slug
      yanıtında görünür olur
```

Email bildirim worker'ı (`workers/notifier.js`) `comments` tablosunu da izleyecek şekilde genişletilebilir; mevcut SMTP ayarları ve e-posta şablonu altyapısı doğrudan kullanılabilir.

---

### 13.11 Next.js / SSG / SSR ile Entegrasyon

Portfolio siteniz Next.js veya benzer bir SSG framework kullandığı durumlarda dikkat edilmesi gerekenler:

| Durum | Yorum/Clap Yükleme Stratejisi |
|---|---|
| SSG (statik build) | `useEffect` içinde client-side fetch; yorumlar build'e dahil olmaz → gerçek zamanlı |
| SSR (`getServerSideProps`) | Build sırasında onaylı yorumlar çekilir; yeni yorumlar SWR/React Query ile hydrate edilir |
| ISR (Incremental Static Regeneration) | Her `revalidate` döngüsünde onaylı yorum sayısı güncellenir; clap client-side kalır |

**Tavsiye:** Clap sayısı her zaman client-side fetch edilmeli (cache'lenmiş stale veri göstermek kötü UX'tir). Yorum listesi ISR ile 60 saniye önbelleklenebilir.

#### Next.js Örnek Bileşeni

```jsx
// components/BlogEngage.jsx
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_CONTACT_API_URL;
const KEY = process.env.NEXT_PUBLIC_CONTACT_API_KEY;

export default function BlogEngage({ slug }) {
  const [comments, setComments] = useState([]);
  const [claps, setClaps]       = useState(0);
  const [myClaps, setMyClaps]   = useState(0);
  const [form, setForm]         = useState({ author_name: '', author_email: '', content: '' });
  const [status, setStatus]     = useState(null); // 'sending' | 'sent' | 'error'

  useEffect(() => {
    fetch(`${API}/api/comments/${slug}?api_key=${KEY}`)
      .then(r => r.json())
      .then(d => setComments(d.comments));

    fetch(`${API}/api/reactions/${slug}?api_key=${KEY}`)
      .then(r => r.json())
      .then(d => { setClaps(d.reactions.clap || 0); setMyClaps(d.user_reaction?.clap || 0); });
  }, [slug]);

  async function handleClap() {
    if (myClaps >= 50) return;
    setMyClaps(p => p + 1);
    setClaps(p => p + 1);
    await fetch(`${API}/api/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: KEY, article_slug: slug, reaction_type: 'clap', count: 1 })
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    const res = await fetch(`${API}/api/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: KEY,
        article_slug: slug,
        data: { ...form, _hp: '' }
      })
    });
    setStatus(res.ok ? 'sent' : 'error');
  }

  return (
    <section>
      <button onClick={handleClap} disabled={myClaps >= 50}>
        👏 {claps} {myClaps > 0 && `(senin: ${myClaps})`}
      </button>

      <h3>Yorumlar ({comments.length})</h3>
      {comments.map(c => (
        <div key={c.id}>
          <strong>{c.author_name}</strong>
          <p>{c.content}</p>
          <small>{new Date(c.created_at).toLocaleDateString('tr-TR')}</small>
        </div>
      ))}

      <form onSubmit={handleSubmit}>
        <input placeholder="Adınız" value={form.author_name}
          onChange={e => setForm(p => ({ ...p, author_name: e.target.value }))} required />
        <input type="email" placeholder="E-posta (gizli)" value={form.author_email}
          onChange={e => setForm(p => ({ ...p, author_email: e.target.value }))} />
        <textarea placeholder="Yorumunuz..." value={form.content}
          onChange={e => setForm(p => ({ ...p, content: e.target.value }))} required />
        <input type="text" name="_hp" style={{ display: 'none' }} tabIndex={-1} />
        <button type="submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Gönderiliyor...' : 'Yorum Gönder'}
        </button>
        {status === 'sent' && <p>Yorumunuz incelemeye alındı, teşekkürler!</p>}
      </form>
    </section>
  );
}
```

---

### 13.12 Uygulama Yol Haritası

Öncelik sırasına göre geliştirim aşamaları:

#### Aşama 1 — Temel Altyapı (1-2 gün)
- [ ] `migrations/004_comments_table.sql` oluştur
- [ ] `migrations/005_reactions_table.sql` oluştur
- [ ] `npm run migrate` ile canlıya uygula

#### Aşama 2 — Backend API (2-3 gün)
- [ ] `routes/comments.js` — public GET + POST
- [ ] `routes/reactions.js` — public GET + POST (UPSERT mantığı)
- [ ] `routes/adminComments.js` — liste, onayla, reddet, sil
- [ ] `middleware/rateLimit.js`'e `commentLimiter` ve `reactionLimiter` ekle
- [ ] `index.js`'e route bağlantılarını ekle
- [ ] `workers/notifier.js`'e yeni yorum bildirimi ekle

#### Aşama 3 — Admin Paneli (1-2 gün)
- [ ] `public/admin/pages/comments.js` sayfası oluştur
- [ ] `router.js`'e `/admin/comments` rotası ekle
- [ ] Sidebar'a "Yorumlar" navigasyon öğesi ekle

#### Aşama 4 — Frontend Widget (2-3 gün)
- [ ] `public/widget/engage.js` — embed script
- [ ] `public/widget/engage.css` — temel stiller
- [ ] Vanilla JS veya Next.js bileşeni portfolio sitesine entegre et
- [ ] E2E test: yorum gönder → admin onayla → sayfada görün

#### Aşama 5 — İyileştirmeler (isteğe bağlı)
- [ ] `GET /api/comments/:slug` yanıtına sayfalama ekle (`?page`, `?limit`)
- [ ] Clap animasyonu (CSS + JS debounce)
- [ ] Sisteme özel RSS feed'i için yorum timestamp'i
- [ ] Emoji reaksiyon tipleri genişletmesi (`heart`, `fire` vb.)

---

### 13.13 Özet Karar Tablosu

| Konu | Karar | Gerekçe |
|---|---|---|
| Veri modeli | Yeni tablolar (`comments`, `reactions`) | Temiz şema, iyi performans |
| Kimlik doğrulama | API key (mevcut altyapı) | OAuth/sosyal giriş gerekmez |
| Tekil clap sınırı | Fingerprint (IP+UA hash) | KVKK/GDPR uyumlu, anonim |
| Yorum moderasyonu | Pending → Admin onay | Bot ve spam koruması |
| Frontend yaklaşım | Script embed veya framework bileşeni | Her iki seçenek de uygulanabilir |
| Email bildirimi | Mevcut notifier worker genişletilir | Sıfır ek altyapı |
| XSS koruması | Backend escape + frontend `textContent` | Kritik; ihmal edilmemeli |
| Gerçek zamanlılık | Client-side polling (5-10sn) veya SWR | WebSocket overkill; polling yeterli |
