-- Migration 004: Blog yorum sistemi
-- comments tablosu — avatar_id ile kullanıcı kişiselleştirmesi dahil

CREATE TABLE IF NOT EXISTS comments (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  article_slug  VARCHAR(255)   NOT NULL,
  channel_id    INT            NOT NULL,
  author_name   VARCHAR(100)   NOT NULL DEFAULT 'Anonim',
  author_email  VARCHAR(255)   NULL,                               -- gizli, public API'de açığa çıkmaz
  content       TEXT           NOT NULL,
  avatar_id     TINYINT        NULL DEFAULT NULL,                  -- 1-8 arası; NULL = default avatar
  ip_address    VARCHAR(45)    NULL,
  status        ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_comments_slug    (article_slug),
  INDEX idx_comments_status  (article_slug, status),
  INDEX idx_comments_channel (channel_id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
