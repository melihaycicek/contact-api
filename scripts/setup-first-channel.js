/**
 * İlk kurulum scripti: Admin oluştur + Portfolio kanalı oluştur
 * 
 * Kullanım (cPanel SSH terminali):
 *   node scripts/setup-first-channel.js <admin-password>
 * 
 * Örnek:
 *   node scripts/setup-first-channel.js MySecret123!
 * 
 * Çıktı olarak API key alırsın → .env.local'e kopyala.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool   = require('../config/db');

async function setup() {
  const adminUsername = 'melihaycicek';
  const adminPassword = process.argv[2];

  if (!adminPassword) {
    console.error('Kullanım: node scripts/setup-first-channel.js <password>');
    process.exit(1);
  }

  try {
    // ── 1. Admin tablosu oluştur (yoksa) ─────────────────
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS admins (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        username      VARCHAR(50)  NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── 2. Admin kullanıcı oluştur / güncelle ─────────────
    const hash = await bcrypt.hash(adminPassword, 12);
    const [existing] = await pool.execute(
      'SELECT id FROM admins WHERE username = ?',
      [adminUsername]
    );

    if (existing.length > 0) {
      await pool.execute(
        'UPDATE admins SET password_hash = ? WHERE username = ?',
        [hash, adminUsername]
      );
      console.log(`✅ Admin "${adminUsername}" şifresi güncellendi.`);
    } else {
      await pool.execute(
        'INSERT INTO admins (username, password_hash) VALUES (?, ?)',
        [adminUsername, hash]
      );
      console.log(`✅ Admin "${adminUsername}" oluşturuldu.`);
    }

    // ── 3. Channels tablosu oluştur (yoksa) ──────────────
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS channels (
        id                 INT AUTO_INCREMENT PRIMARY KEY,
        channel_name       VARCHAR(100) NOT NULL UNIQUE,
        api_key            VARCHAR(64)  NOT NULL UNIQUE,
        notification_email VARCHAR(255),
        created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // ── 4. Portfolio kanalı oluştur (yoksa) ───────────────
    const channelName = 'portfolio-main';
    const [existingChannel] = await pool.execute(
      'SELECT id, api_key FROM channels WHERE channel_name = ?',
      [channelName]
    );

    let apiKey;
    if (existingChannel.length > 0) {
      apiKey = existingChannel[0].api_key;
      console.log(`✅ Kanal "${channelName}" zaten var.`);
    } else {
      apiKey = crypto.randomBytes(24).toString('hex'); // 48 char hex
      await pool.execute(
        'INSERT INTO channels (channel_name, api_key, notification_email) VALUES (?, ?, ?)',
        [channelName, apiKey, 'melihaycicek.kafein@gmail.com']
      );
      console.log(`✅ Kanal "${channelName}" oluşturuldu.`);
    }

    console.log('\n══════════════════════════════════════════════');
    console.log('  PORTFOLIO .env.local\'E EKLEYECEKLERİN:');
    console.log('══════════════════════════════════════════════');
    console.log(`  REACT_APP_ENGAGEMENT_API=https://audfix.com`);
    console.log(`  REACT_APP_ENGAGEMENT_KEY=${apiKey}`);
    console.log('══════════════════════════════════════════════\n');
    console.log('Admin giriş bilgileri:');
    console.log(`  URL:      https://audfix.com/contact-api/admin`);
    console.log(`  Kullanıcı: ${adminUsername}`);
    console.log(`  Şifre:     <girdiğin şifre>`);

  } catch (err) {
    console.error('Kurulum hatası:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setup();
