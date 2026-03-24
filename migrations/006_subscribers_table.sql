-- Migration 006: Bülten abonelik sistemi
-- subscribers tablosu — double opt-in, channel bazlı izolasyon

CREATE TABLE IF NOT EXISTS subscribers (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  channel_id          INT            NOT NULL,
  email               VARCHAR(255)   NOT NULL,
  status              ENUM('pending','active','unsubscribed') NOT NULL DEFAULT 'pending',
  verify_token        VARCHAR(64)    NULL,                -- double opt-in doğrulama tokeni
  verify_expires_at   DATETIME       NULL,                -- token geçerlilik süresi (24 saat)
  source_slug         VARCHAR(255)   NULL,                -- hangi makaleden abone oldu
  created_at          DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at         DATETIME       NULL,
  unsubscribed_at     DATETIME       NULL,

  UNIQUE KEY uq_subscriber (channel_id, email),
  INDEX idx_sub_status  (channel_id, status),
  INDEX idx_sub_token   (verify_token)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
