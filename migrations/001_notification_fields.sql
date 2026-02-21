-- Migration 001: Bildirim sistemi için submissions tablosu güncelleme
-- channels tablosuna ek kolonlar

-- submissions tablosuna bildirim alanları
ALTER TABLE submissions
  ADD COLUMN notified TINYINT(1) NOT NULL DEFAULT 0 AFTER is_verified,
  ADD COLUMN notified_at DATETIME NULL DEFAULT NULL AFTER notified;

-- channels tablosuna durum ve bildirim email
ALTER TABLE channels
  ADD COLUMN status ENUM('active', 'inactive') NOT NULL DEFAULT 'active' AFTER api_key,
  ADD COLUMN notification_email VARCHAR(255) NULL DEFAULT NULL AFTER status,
  ADD COLUMN domain VARCHAR(255) NULL DEFAULT NULL AFTER name;

-- notified=0 sorgularını hızlandırmak için index
CREATE INDEX idx_submissions_notified ON submissions (notified);
CREATE INDEX idx_submissions_channel_created ON submissions (channel_id, created_at);
