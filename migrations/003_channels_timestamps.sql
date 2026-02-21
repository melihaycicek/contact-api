-- Migration 003: channels tablosuna created_at kolonu (yoksa)
ALTER TABLE channels
  ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Eğer name kolonu yoksa ekle
-- ALTER TABLE channels ADD COLUMN name VARCHAR(100) NULL AFTER id;
