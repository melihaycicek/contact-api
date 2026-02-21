-- Migration 002: Admin kullanıcıları tablosu
CREATE TABLE IF NOT EXISTS admins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Varsayılan admin kullanıcı (şifre: admin123 — İLK GİRİŞTE DEĞİŞTİRİN!)
-- Bcrypt hash'i uygulama tarafında oluşturulacak, bu sadece tablo yapısı.
