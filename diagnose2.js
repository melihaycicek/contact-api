/**
 * diagnose2.js – Daha detaylı teşhis: 
 * - Log dosyası ne zaman güncellendi?
 * - Node process PID ve başlangıç zamanı
 * - stderr.log'un boyutu ve md5'i
 * - nodevenv cache kontrolü
 * - api.js satır 18 civarı
 */
const { Client } = require('ssh2');
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

async function run() {
  console.log('=== 1) stderr.log bilgileri ===');
  const { out: logInfo } = await sshExec(`
    ls -la ~/contact-api/stderr.log
    echo "---"
    stat ~/contact-api/stderr.log 2>/dev/null | grep -i modify
    echo "---"
    wc -l ~/contact-api/stderr.log
  `);
  console.log(logInfo);

  console.log('=== 2) Node process detay ===');
  const { out: procInfo } = await sshExec(`
    ps -eo pid,lstart,cmd | grep "contact-api" | grep -v grep
  `);
  console.log(procInfo);

  console.log('=== 3) api.js satır numaralarıyla (satır 15-25) ===');
  const { out: apiLines } = await sshExec(`
    sed -n '15,25p' ~/contact-api/routes/api.js | cat -n
  `);
  console.log(apiLines);

  console.log('=== 4) api.js dosya tarihi ===');
  const { out: apiDate } = await sshExec(`
    ls -la ~/contact-api/routes/api.js
    stat ~/contact-api/routes/api.js | grep -i modify
  `);
  console.log(apiDate);

  console.log('=== 5) stderr.log temizleyip test ===');
  // stderr.log'u truncate et, sonra health check ile test et
  const { out: clearLog } = await sshExec(`
    > ~/contact-api/stderr.log
    echo "Log temizlendi. Boyut:"
    wc -c ~/contact-api/stderr.log
  `);
  console.log(clearLog);

  // Bir test isteği gönder
  console.log('=== 6) Test: /api/submit isteği gönder ===');
  const { out: testResult, errOut: testErr } = await sshExec(`
    curl -s -w "\\n---HTTP_CODE:%{http_code}---" -X POST http://127.0.0.1:3100/api/submit \\
      -H "Content-Type: application/json" \\
      -d '{"api_key":"aud_live_aycicek_oRH7TG4M8DOuTuHuzL1REq17","data":{"name":"TEST_DIAG","email":"test@test.com","message":"diagnose2 test"},"verification_token":"dummy.token"}'
  `);
  console.log('Response:', testResult);
  if (testErr) console.log('curl stderr:', testErr);

  // Health check
  console.log('\n=== 7) Health check ===');
  const { out: health } = await sshExec(`
    curl -s http://127.0.0.1:3100/health
  `);
  console.log(health);

  // Yeni stderr.log'a bak
  console.log('\n=== 8) Yeni stderr.log içeriği (temizleme sonrası) ===');
  const { out: newLog } = await sshExec(`
    cat ~/contact-api/stderr.log
  `);
  console.log(newLog || '(boş - hata yok!)');

  // nodevenv kontrolü - require cache'de eski dosya var mı?
  console.log('\n=== 9) nodevenv yapısı ===');
  const { out: nodevenv } = await sshExec(`
    ls -la ~/nodevenv/contact-api/22/lib/node_modules/ | head -20
    echo "---"
    # Proje node_modules var mı?
    ls -la ~/contact-api/node_modules/ 2>/dev/null | head -10 || echo "(proje node_modules yok)"
  `);
  console.log(nodevenv);

  console.log('\n=== 10) package.json (sunucudaki) ===');
  const { out: pkg } = await sshExec(`cat ~/contact-api/package.json`);
  console.log(pkg);

  console.log('\nTeşhis tamamlandı.');
}

run().catch(err => { console.error('Hata:', err.message); process.exit(1); });
