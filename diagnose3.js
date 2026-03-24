/**
 * diagnose3.js – External URL test + app durumu
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
  // 1. Domain ve vhost yapısı bul
  console.log('=== 1) Domain / vhost bilgisi ===');
  const { out: domains } = await sshExec(`
    # cPanel domain listesi
    cat ~/etc/*/passwd 2>/dev/null | head -5
    echo "---"
    # httpd.conf'ta domain bilgileri
    grep -r "contact-api" /home/audfllcd/.htaccess 2>/dev/null
    echo "---"
    # .htaccess kontrol
    cat ~/contact-api/.htaccess 2>/dev/null || echo "(yok)"
    echo "---"
    # domain listesi    
    ls ~/public_html/ 2>/dev/null | head -10
    echo "---"
    # Tüm domain'leri listele
    uapi DomainInfo list_domains 2>/dev/null | head -30  || echo "(uapi yok)"
  `);
  console.log(domains);

  // 2. cPanel Node.js app konfigürasyonu
  console.log('=== 2) cPanel Node.js uygulama konfigürasyonu ===');
  const { out: appConfig } = await sshExec(`
    # Application manager config
    cat ~/nodevenv/contact-api/22/lib/.app_config 2>/dev/null || echo "(yok)"
    echo "---"
    # Check .application_startup
    find ~ -maxdepth 3 -name ".application_startup" 2>/dev/null
    echo "---"
    # lsnode binding
    cat ~/contact-api/.env 2>/dev/null
    echo "---"
    # LiteSpeed context
    find ~ -maxdepth 2 -name "*.conf" 2>/dev/null | head -5
  `);
  console.log(appConfig);

  // 3. Uygulamanın dinlediği port/socket
  console.log('=== 3) lsnode bağlantı bilgisi ===');
  const { out: lsInfo } = await sshExec(`
    # lsnode process'in açık port/socket'leri
    ls -la /tmp/lshttpd/ 2>/dev/null | head -10
    echo "---"
    # netstat/ss ile Node portları
    ss -tlnp 2>/dev/null | grep node || netstat -tlnp 2>/dev/null | grep node || echo "(Port bulunamadı)"
    echo "---"
    # localhost test - farklı portlar
    for port in 3100 3000 8080 80; do
      CODE=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 2 http://127.0.0.1:$port/health 2>/dev/null)
      echo "Port $port: HTTP $CODE"
    done
  `);
  console.log(lsInfo);

  // 4. External test (sunucunun kendi domain'i ile)
  console.log('=== 4) External URL testi ===');
  const { out: extTest } = await sshExec(`
    # Hostname
    hostname
    echo "---"
    # cPanel kullanıcı domain
    cat ~/.contactemail 2>/dev/null || echo ""
    echo "---"
    # Test with external domain
    for domain in "contact-api.audfix.com" "audfix.com" "$(hostname)"; do
      CODE=$(curl -sk -o /tmp/contact_test_out.txt -w "%{http_code}" --connect-timeout 5 -X POST "https://$domain/api/submit" \\
        -H "Content-Type: application/json" \\
        -d '{"api_key":"aud_live_aycicek_oRH7TG4M8DOuTuHuzL1REq17","data":{"name":"DIAG3","email":"test@test.com","message":"diag3"},"verification_token":"dummy.tok"}' 2>/dev/null)
      echo "$domain -> HTTP $CODE"
      cat /tmp/contact_test_out.txt 2>/dev/null
      echo ""
    done
  `);
  console.log(extTest);

  // 5. stderr.log kontrolü (temizlenmişti, yeni hata var mı?)
  console.log('=== 5) stderr.log (yeni hatalar) ===');
  const { out: newErr } = await sshExec(`cat ~/contact-api/stderr.log`);
  console.log(newErr || '(boş)');

  // 6. stdout.log kontrolü
  console.log('=== 6) stdout.log ===');
  const { out: stdout } = await sshExec(`tail -20 ~/contact-api/stdout.log 2>/dev/null || echo "(yok)"`);
  console.log(stdout);

  console.log('\nTeşhis tamamlandı.');
}

run().catch(err => { console.error('Hata:', err.message); process.exit(1); });
