-- Migration 001: Bildirim sistemi için submissions tablosu güncelleme
-- NOT: Bu migration canlı DB'ye zaten uygulanmıştır (2026-02-22)

-- submissions tablosuna bildirim alanları (UYGULANMIŞ)
ALTER TABLE submissions
  ADD COLUMN notified TINYINT(1) NOT NULL DEFAULT 0 AFTER is_verified,
  ADD COLUMN notified_at DATETIME NULL DEFAULT NULL AFTER notified;

-- channels tablosuna bildirim email (UYGULANMIŞ)
-- NOT: Canlı DB'de kolon adı "channel_name" dir, "name" değil.
-- NOT: status ve domain kolonları canlı DB'de YOKTUR.
ALTER TABLE channels
  ADD COLUMN notification_email VARCHAR(255) NULL DEFAULT NULL AFTER api_key;

-- notified=0 sorgularını hızlandırmak için index
CREATE INDEX idx_submissions_notified ON submissions (notified);
CREATE INDEX idx_submissions_channel_created ON submissions (channel_id, created_at);
