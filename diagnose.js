/**
 * diagnose.js – SSH üzerinden canlı sunucuyu teşhis eder.
 * 1) Sunucudaki routes/api.js içeriği (hangi kod çalışıyor?)
 * 2) Son hata logları
 * 3) MySQL'den son submission kayıtları
 * 4) Node.js process durumu
 */
const { Client } = require('ssh2');
const { createTunnel } = require('tunnel-ssh');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const sshKeyPath = path.join(process.env.USERPROFILE || process.env.HOME, '.ssh', 'audfix_ed25519');
const privateKey = fs.readFileSync(sshKeyPath);

const sshOpts = {
  host: '162.0.217.214',
  port: 21098,
  username: 'audfllcd',
  privateKey,
  passphrase: 'd7rXe*Ag^~_P 82%b1B@qc$gv',
};

// --- 1) SSH komut çalıştır ---
function sshExec(command) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        let out = '', errOut = '';
        stream.on('data', d => out += d.toString());
        stream.stderr.on('data', d => errOut += d.toString());
        stream.on('close', () => { conn.end(); resolve({ out, errOut }); });
      });
    });
    conn.on('error', reject);
    conn.connect(sshOpts);
  });
}

async function runDiagnostics() {
  console.log('=== 1) Sunucudaki app dizin yapısı ===');
  try {
    // cPanel'de Node.js uygulamaları genellikle ~/public_html/ veya ~/contact-api/ altında olur
    const { out: findApp } = await sshExec('find ~ -maxdepth 3 -name "index.js" -path "*/contact*" 2>/dev/null || find ~ -maxdepth 3 -name "package.json" -path "*/contact*" 2>/dev/null');
    console.log(findApp || '(bulunamadı)');
  } catch (e) { console.error('Hata:', e.message); }

  console.log('\n=== 2) Sunucudaki routes/api.js dosyası ===');
  try {
    // Ortak cPanel yollarını dene
    const { out: apiContent } = await sshExec(`
      for dir in ~/contact-api ~/public_html/contact-api ~/nodejs/contact-api ~/applications/contact-api; do
        if [ -f "$dir/routes/api.js" ]; then
          echo "### FOUND: $dir/routes/api.js ###"
          cat "$dir/routes/api.js"
          exit 0
        fi
      done
      # Genel arama
      FOUND=$(find ~ -maxdepth 4 -path "*/routes/api.js" 2>/dev/null | head -1)
      if [ -n "$FOUND" ]; then
        echo "### FOUND: $FOUND ###"
        cat "$FOUND"
      else
        echo "(routes/api.js bulunamadı)"
      fi
    `);
    console.log(apiContent);
  } catch (e) { console.error('Hata:', e.message); }

  console.log('\n=== 3) Sunucudaki index.js dosyası ===');
  try {
    const { out: indexContent } = await sshExec(`
      FOUND=$(find ~ -maxdepth 4 -name "index.js" -path "*/contact*" 2>/dev/null | head -1)
      if [ -n "$FOUND" ]; then
        echo "### FOUND: $FOUND ###"
        cat "$FOUND"
      else
        echo "(index.js bulunamadı)"
      fi
    `);
    console.log(indexContent);
  } catch (e) { console.error('Hata:', e.message); }

  console.log('\n=== 4) Node.js süreç durumu ===');
  try {
    const { out: procs } = await sshExec('ps aux | grep -i node | grep -v grep 2>/dev/null || echo "(node süreci yok)"');
    console.log(procs);
  } catch (e) { console.error('Hata:', e.message); }

  console.log('\n=== 5) Son error logları ===');
  try {
    const { out: logs } = await sshExec(`
      for f in ~/contact-api/stderr.log ~/contact-api/logs/error.log ~/public_html/contact-api/stderr.log; do
        if [ -f "$f" ]; then
          echo "### $f (son 50 satır) ###"
          tail -50 "$f"
          echo ""
        fi
      done
      # Genel arama
      FOUND=$(find ~ -maxdepth 4 -name "stderr.log" -path "*/contact*" 2>/dev/null | head -1)
      if [ -n "$FOUND" ]; then
        echo "### $FOUND (son 50 satır) ###"
        tail -50 "$FOUND"
      fi
      FOUND2=$(find ~ -maxdepth 4 -name "*.log" -path "*/contact*" 2>/dev/null)
      if [ -n "$FOUND2" ]; then
        echo "### Log dosyaları: ###"
        echo "$FOUND2"
      fi
    `);
    console.log(logs || '(log bulunamadı)');
  } catch (e) { console.error('Hata:', e.message); }

  console.log('\n=== 6) Git durumu (sunucuda) ===');
  try {
    const { out: gitInfo } = await sshExec(`
      FOUND=$(find ~ -maxdepth 3 -name ".git" -path "*/contact*" -type d 2>/dev/null | head -1)
      if [ -n "$FOUND" ]; then
        REPO_DIR=$(dirname "$FOUND")
        echo "Repo: $REPO_DIR"
        cd "$REPO_DIR"
        echo "Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
        echo "Son commit: $(git log --oneline -1 2>/dev/null)"
        echo "Durum:"
        git status --short 2>/dev/null
      else
        echo "(git repo bulunamadı)"
      fi
    `);
    console.log(gitInfo);
  } catch (e) { console.error('Hata:', e.message); }

  // --- 7) MySQL sorguları ---
  console.log('\n=== 7) MySQL – Son 5 submission ===');
  try {
    const [server] = await createTunnel(
      { autoClose: true },
      { port: 3307 },
      sshOpts,
      { srcAddr: '127.0.0.1', srcPort: 3307, dstAddr: '127.0.0.1', dstPort: 3306 }
    );

    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3307,
      user: 'audfllcd_audfix_user',
      password: '{B~}p?n1%uf=5bgjcOeYh+h;',
      database: 'audfllcd_contact_form',
    });

    const [submissions] = await conn.query('SELECT * FROM submissions ORDER BY id DESC LIMIT 5');
    console.log(JSON.stringify(submissions, null, 2));

    console.log('\n=== 8) Channels tablosu ===');
    const [channels] = await conn.query('SELECT * FROM channels');
    console.log(JSON.stringify(channels, null, 2));

    console.log('\n=== 9) Admins tablosu (sadece var/yok) ===');
    try {
      const [admins] = await conn.query('SELECT id, username, created_at FROM admins');
      console.log(JSON.stringify(admins, null, 2));
    } catch (e) {
      console.log('admins tablosu bulunamadı:', e.message);
    }

    await conn.end();
    server.close();
  } catch (e) {
    console.error('MySQL hatası:', e.message);
  }

  console.log('\nTeşhis tamamlandı.');
}

runDiagnostics().catch(err => {
  console.error('Genel hata:', err);
  process.exit(1);
});
