-- Migration 005: Blog beğeni / clap sistemi
-- reactions tablosu — fingerprint tabanlı anonim tekil kontrol

CREATE TABLE IF NOT EXISTS reactions (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  article_slug  VARCHAR(255)   NOT NULL,
  channel_id    INT            NOT NULL,
  reaction_type VARCHAR(20)    NOT NULL DEFAULT 'clap',  -- 'clap', 'like', 'heart'
  fingerprint   VARCHAR(64)    NOT NULL,                 -- SHA-256(ip + userAgent) — anonim, KVKK uyumlu
  count         TINYINT        NOT NULL DEFAULT 1,       -- kişi başı max 50, Medium tarzı
  created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  UNIQUE KEY uq_reaction (article_slug, channel_id, reaction_type, fingerprint),
  INDEX idx_reaction_slug (article_slug, reaction_type)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
