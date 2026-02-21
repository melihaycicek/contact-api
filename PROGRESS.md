# Contact API – Geliştirme İlerleme Takibi

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
