/**
 * İlk admin kullanıcısını oluşturma scripti
 * Kullanım: node scripts/seed-admin.js [username] [password]
 * Örnek:    node scripts/seed-admin.js admin MySecurePass123
 */

const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function seedAdmin() {
  const username = process.argv[2] || 'admin';
  const password = process.argv[3] || 'admin123';

  try {
    // Tablo var mı kontrol et, yoksa oluştur
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS admins (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(50) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Kullanıcı zaten var mı?
    const [existing] = await pool.execute('SELECT id FROM admins WHERE username = ?', [username]);
    if (existing.length > 0) {
      console.log(`Admin "${username}" zaten mevcut. Şifresi güncelleniyor...`);
      const hash = await bcrypt.hash(password, 10);
      await pool.execute('UPDATE admins SET password_hash = ? WHERE username = ?', [hash, username]);
      console.log('Şifre güncellendi.');
    } else {
      const hash = await bcrypt.hash(password, 10);
      await pool.execute(
        'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
        [username, hash]
      );
      console.log(`Admin kullanıcı oluşturuldu: ${username}`);
    }

    console.log('⚠️  Şifreyi güçlü bir şifreyle değiştirin!');
  } catch (error) {
    console.error('Seed hatası:', error);
  }

  process.exit(0);
}

seedAdmin();
