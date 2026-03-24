# Contact API – Geliştirme İlerleme Takibi

> Son güncelleme: 2026-03-23

## Mevcut Durum Analizi

### Var Olan
- Express server, tek endpoint: `POST /api/submit`
- MySQL pool bağlantısı (`mysql2/promise`)
- `channels` tablosu: api_key ile kanal doğrulama
- `submissions` tablosu: channel_id, form_data (JSON), ip_address, is_verified
- CORS açık (`app.use(cors())`)
- `verification_token` kontrolü var ama gerçek doğrulama yapılmıyor
- `.env` ile DB credentials

### Yapılacaklar

---

## A) Bildirim (Email) Sistemi
- [x] `submissions` tablosuna `notified` (TINYINT DEFAULT 0) ve `notified_at` (DATETIME NULL) kolonları ekle
- [x] `channels` tablosuna `notification_email` (VARCHAR NULL) kolonu ekle
- [x] `workers/notifier.js` – Cron worker: notified=0 kayıtları bul → mail at → notified=1 yap
- [x] `.env`'ye SMTP ayarları ekle (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM)

## B) Yönetim Ekranı (Admin Panel)

### Backend API
- [x] `admins` tablosu oluştur (id, username, password_hash, created_at)
- [x] `POST /admin/login` – JWT token döndür
- [x] Auth middleware – JWT doğrulama
- [x] `GET /admin/channels` – Channel listesi
- [x] `POST /admin/channels` – Yeni channel ekle
- [x] `PUT /admin/channels/:id` – Channel güncelle (name, domain, status, notification_email)
- [x] `POST /admin/channels/:id/regenerate-key` – API key yenile
- [x] `GET /admin/submissions` – Filtreli liste (channel, tarih, notified, keyword)
- [x] `GET /admin/submissions/:id` – Detay (full JSON + meta)
- [x] `PUT /admin/submissions/:id/notify` – Manuel notified=1 yap
- [x] `DELETE /admin/submissions/:id` – Silme (GDPR)
- [x] `GET /admin/submissions/export` – CSV export

### Frontend (Tek Sayfa SPA)
- [x] Login ekranı
- [x] Dashboard / Channels yönetimi
- [x] Submissions listesi + filtreleme
- [x] Submission detay modal

## C) Güvenlik İyileştirmeleri
- [x] CORS kısıtlama: sadece izinli originler + admin panel
- [x] Rate limiting: `/api/submit` için (express-rate-limit)
- [x] Honeypot alan desteği (`_hp` field → varsa reject)
- [x] `verification_token` gerçek doğrulama (basit HMAC veya zaman bazlı)
- [x] `channels` tablosuna `status` kolonu (active/inactive) – inactive channel reject

## D) Altyapı
- [x] Proje klasör yapısı düzenle (routes/, middleware/, workers/, public/)
- [x] package.json bağımlılıkları güncelle
- [x] .env.example oluştur
- [x] README güncellenecek
- [x] SQL migration dosyaları

---

## E) Blog Etkileşim Sistemi (2026-03-23)

Portfolio blog'u için yorum, beğeni (clap) ve bülten aboneliği sistemi.

### Backend Kod (Tamamlandı ✅)

#### Public API Route'ları
- [x] `GET  /api/comments/:slug` — Onaylı yorumları listele (api_key query param)
- [x] `POST /api/comments` — Yeni yorum gönder (pending, avatar_id 1-8)
- [x] `GET  /api/reactions/:slug` — Toplam + kullanıcı reaction sayıları
- [x] `POST /api/reactions` — Clap / like / heart ekle (fingerprint tabanlı limit)
- [x] `POST /api/subscribe` — Bülten aboneliği başlat (double opt-in)
- [x] `GET  /api/subscribe/verify?token=...` — E-posta doğrulama
- [x] `GET  /api/unsubscribe?token=...` — Abonelik iptali

#### Admin API Route'ları
- [x] `GET  /admin/api/comments` — Filtreli liste (status, slug, channel_id)
- [x] `GET  /admin/api/comments/:id` — Yorum detayı
- [x] `PUT  /admin/api/comments/:id/approve` — Yorumu onayla
- [x] `PUT  /admin/api/comments/:id/reject` — Yorumu reddet
- [x] `DELETE /admin/api/comments/:id` — Yorumu sil (GDPR)
- [x] `GET  /admin/api/reactions` — Makale bazlı reaction özeti
- [x] `GET  /admin/api/subscribers` — Abone listesi (filtreli)
- [x] `GET  /admin/api/subscribers/export` — Aktif aboneleri CSV indir

#### SQL Migrasyonlar
- [x] `004_comments_table.sql` — comments tablosu (avatar_id, status, index'ler)
- [x] `005_reactions_table.sql` — reactions tablosu (fingerprint, uq constraint)
- [x] `006_subscribers_table.sql` — subscribers tablosu (double opt-in token)

#### Widget
- [x] `public/widget/engage.js` — Vanilla JS embed widget (reactions + comments)
- [x] `public/widget/engage.css` — Widget stilleri

### Deploy / Yapılandırma — MELİH'İN YAPACAKLARI ⏳

#### 1. cPanel — SQL Migrasyonlar
- [ ] phpMyAdmin'i aç → `audfllcd_contact_form` veritabanını seç
- [ ] `migrations/004_comments_table.sql` içeriğini çalıştır → `comments` tablosu oluşur
- [ ] `migrations/005_reactions_table.sql` içeriğini çalıştır → `reactions` tablosu oluşur
- [ ] `migrations/006_subscribers_table.sql` içeriğini çalıştır → `subscribers` tablosu oluşur

#### 2. cPanel — `.env` Güncellemeleri
- [ ] `APP_URL=https://audfix.com` ekle (double opt-in doğrulama linki için **kritik**)
- [ ] `ALLOWED_ORIGINS` satırına `https://melihaycicek.com` ekle  
  Örnek: `ALLOWED_ORIGINS=https://melihaycicek.com,https://admin.audfix.com`

#### 3. cPanel — contact-api kodunu pull et
- [ ] SSH veya Git Manager ile `development` branch'ini pull et
- [ ] `npm install` çalıştır (yeni bağımlılık yok, kontrol amaçlı)
- [ ] Passenger / Node.js App Manager'dan uygulamayı restart et

#### 4. Admin Panel — Channel Oluştur
- [ ] `/admin` paneline gir → Channels → "Portfolio Blog" adıyla yeni channel ekle
- [ ] Oluşan `api_key` değerini kopyala (örn. `ch_abc123...`)

#### 5. Portfolio Projesi — `.env.local` Güncelle
- [ ] `Portfolio-v2-main/.env.local` dosyasına şunu ekle:
  ```
  REACT_APP_ENGAGEMENT_API=https://audfix.com
  REACT_APP_ENGAGEMENT_KEY=ch_abc123...   ← 4. adımdan aldığın key
  ```
- [ ] Projeyi build et ve Firebase'e deploy et

#### 6. Widget için Avatar Dosyaları (contact-api — backend tarafı)
- [ ] `public/widget/avatars/` klasörüne şu isimlerde 8 SVG kopyala:
  `avatar-1.svg`, `avatar-2.svg`, ..., `avatar-8.svg`  
  (Portfolio projesindeki `avatar-astronaut.svg` → `avatar-1.svg` şeklinde sıralamayı takip et)
- [ ] `default.svg` dosyası ekle (avatar seçilmemişse gösterilir)
- [ ] cPanel'e push et / dosyaları File Manager'dan yükle

### Kod Eksikleri (Bekleyen ⏳)

- [ ] **Admin Panel Comments Sayfası** — `public/admin/js/pages/` altında Comments moderasyon UI'ı yok.  
  Backend endpoint'ler hazır (`/admin/api/comments/:id/approve`, `/reject`, `DELETE`).  
  Admin SPA'ya yeni sayfa eklenecek.

### Notlar
- Yorum moderasyonu **zorunlu**: Frontend comment post eder → `status='pending'` → admin onaylar → görünür olur.
- Reactions fingerprint: IP + User-Agent SHA-256 → KVKK uyumlu, geri dönüşü yok.
- Subscribe email: `APP_URL` olmadan verify URL bozuk gelir → cPanel'de eklenmesi kritik.

---

## Bug Fix: HTTP 500 Analizi (2026-02-28)

### Sorun
Form gönderildiğinde `POST /api/submit` → **HTTP 500** dönüyor.

### Kök Neden
Kod, canlı veritabanı şemasıyla **uyumsuzdu**. SSH tüneli üzerinden canlı DB scheması çekildi ve şu farklar bulundu:

| Beklenen (Kod) | Canlı DB (Gerçek) | Durum |
|---|---|---|
| `channels.name` | `channels.channel_name` | **Kolon adı farklı** |
| `channels.status` | *yok* | **Kolon mevcut değil** |
| `channels.domain` | *yok* | **Kolon mevcut değil** |

**500'ü tetikleyen spesifik SQL:**
```sql
-- routes/api.js satır 19:
SELECT id, notification_email FROM channels WHERE api_key = ? AND status = ?
-- "status" kolonu DB'de yok → MySQL hata → catch bloğu → 500
```

### Canlı DB Şeması (Referans)

**channels:**
| Kolon | Tip |
|---|---|
| id | int(11) PK auto_increment |
| channel_name | varchar(50) |
| api_key | varchar(64) UNIQUE |
| created_at | timestamp |
| notification_email | varchar(255) NULL |

**submissions:**
| Kolon | Tip |
|---|---|
| id | int(11) PK auto_increment |
| channel_id | int(11) FK |
| form_data | longtext |
| ip_address | varchar(45) |
| is_verified | tinyint(1) default 0 |
| created_at | timestamp |
| notified | tinyint(1) default 0 |
| notified_at | datetime NULL |

**admins:**
| Kolon | Tip |
|---|---|
| id | int(11) PK auto_increment |
| username | varchar(50) UNIQUE |
| password_hash | varchar(255) |
| created_at | datetime |

### Yapılan Düzeltmeler
1. **routes/api.js** – `status = 'active'` koşulu kaldırıldı
2. **routes/adminChannels.js** – `name` → `channel_name`, `domain`/`status` referansları kaldırıldı
3. **routes/adminSubmissions.js** – `c.name as channel_name` → `c.channel_name`, `c.domain` kaldırıldı
4. **workers/notifier.js** – `c.name as channel_name` → `c.channel_name`
5. **public/admin/js/pages/channels.js** – Frontend: `ch.name` → `ch.channel_name`, domain/status sütunları kaldırıldı
6. **public/admin/js/pages/submissions.js** – Filtre dropdown'da `ch.name` → `ch.channel_name`
7. **migrations/001_notification_fields.sql** – Gerçek DB'yi yansıtacak şekilde güncellendi

---

## İlerleme Kaydı

| Tarih | Yapılan |
|-------|---------|
| 2026-02-21 | Proje analizi tamamlandı, plan oluşturuldu |
| 2026-02-21 | SQL migration dosyaları oluşturuldu (001, 002, 003) |
| 2026-02-21 | Proje yeniden yapılandırıldı (config/, routes/, middleware/, workers/, scripts/) |
| 2026-02-21 | Güvenlik middleware'leri: JWT auth, rate limiting, honeypot, CORS kısıtlama |
| 2026-02-21 | Admin API: login, channels CRUD, submissions CRUD + CSV export + stats |
| 2026-02-21 | /api/submit refactor: channel status kontrolü, honeypot, rate limit, HMAC token |
| 2026-02-21 | Email notification worker (workers/notifier.js) – cron ile çalışır |
| 2026-02-21 | Admin panel SPA (login, dashboard, channels, submissions ekranları) |
| 2026-02-21 | package.json güncellendi, .env.example oluşturuldu |
| 2026-02-21 | README komple yenilendi |
| 2026-02-28 | **BUG FIX:** HTTP 500 – DB şema uyumsuzluğu giderildi (name→channel_name, status/domain kaldırıldı) |
