/**
 * DB Migration çalıştırıcı
 * Kullanım: node scripts/migrate.js
 * migrations/ klasöründeki SQL dosyalarını sırayla çalıştırır.
 */

const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

async function migrate() {
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`${files.length} migration dosyası bulundu.`);

  for (const file of files) {
    console.log(`\n--- Çalıştırılıyor: ${file} ---`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // Her SQL statement'ı ayrı çalıştır (basit split)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const stmt of statements) {
      try {
        await pool.execute(stmt);
        console.log(`  ✓ OK`);
      } catch (err) {
        // "Duplicate column" gibi hatalar ignore edilebilir
        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_DUP_KEYNAME') {
          console.log(`  ⚠ Zaten mevcut, atlanıyor: ${err.message}`);
        } else {
          console.error(`  ✗ HATA: ${err.message}`);
        }
      }
    }
  }

  console.log('\nMigration tamamlandı.');
  process.exit(0);
}

migrate();
