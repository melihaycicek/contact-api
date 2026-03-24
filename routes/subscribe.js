const express = require('express');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const pool = require('../config/db');
const { subscribeLimiter } = require('../middleware/rateLimit');
const { topLevelHoneypotCheck } = require('../middleware/honeypot');

const router = express.Router();

/** HTML tag'larını ve tehlikeli karakterleri silen yardımcı */
function stripTags(str) {
  return String(str).replace(/<[^>]*>/g, '').trim();
}

/**
 * SMTP transporter (index.js'deki notifier ile aynı .env değerlerini kullanır)
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
}

/**
 * Doğrulama e-postası gönderir
 */
async function sendVerifyMail(email, token, channelName) {
  const baseUrl = process.env.APP_URL || `http://localhost:${process.env.PORT || 3100}`;
  const verifyUrl = `${baseUrl}/api/subscribe/verify?token=${token}`;
  const unsubUrl = `${baseUrl}/api/unsubscribe?token=${token}`;

  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `Bülten aboneliğinizi onaylayın — ${channelName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin-bottom:8px">Aboneliğinizi onaylayın</h2>
        <p><strong>${channelName}</strong> bültenine abone olmak için aşağıdaki bağlantıya tıklayın.</p>
        <p style="margin:24px 0">
          <a href="${verifyUrl}"
             style="background:#111;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
            Aboneliği Onayla
          </a>
        </p>
        <p style="font-size:12px;color:#999">
          Bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.<br>
          <a href="${unsubUrl}" style="color:#999">Abonelikten çık</a>
        </p>
      </div>
    `
  });
}

/**
 * POST /api/subscribe
 * Bülten aboneliği başlatır; double opt-in doğrulama maili gönderir.
 *
 * Body: { api_key, email, source_slug? }
 */
router.post('/subscribe', subscribeLimiter, topLevelHoneypotCheck, async (req, res) => {
  const { api_key, email, source_slug: rawSlug = null } = req.body;
  // source_slug: yalnızca URL-güvenli karakterler, max 200 karakter
  const source_slug = rawSlug ? stripTags(rawSlug).slice(0, 200) : null;

  if (!api_key || !email) {
    return res.status(400).json({ error: 'api_key ve email zorunludur.' });
  }

  // Basit email format kontrolü
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Geçerli bir e-posta adresi girin.' });
  }

  try {
    const [channels] = await pool.execute(
      'SELECT id, channel_name FROM channels WHERE api_key = ?',
      [api_key]
    );
    if (channels.length === 0) {
      return res.status(403).json({ error: 'Geçersiz API Anahtarı.' });
    }
    const { id: channelId, channel_name: channelName } = channels[0];

    // Mevcut aktif aboneyi kontrol et
    const [existing] = await pool.execute(
      'SELECT id, status FROM subscribers WHERE channel_id = ? AND email = ?',
      [channelId, email]
    );

    if (existing.length > 0 && existing[0].status === 'active') {
      // Sessizce 200 döner; email enumeration'ı önler
      return res.json({ success: 'Abonelik isteği alındı. Lütfen e-postanızı kontrol edin.' });
    }

    // Token üret
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 saat

    if (existing.length > 0) {
      // Var olan pending/unsubscribed kaydı güncelle
      await pool.execute(
        `UPDATE subscribers
         SET status='pending', verify_token=?, verify_expires_at=?, source_slug=?, unsubscribed_at=NULL
         WHERE id=?`,
        [token, expiresAt, source_slug, existing[0].id]
      );
    } else {
      // Yeni kayıt
      await pool.execute(
        `INSERT INTO subscribers (channel_id, email, status, verify_token, verify_expires_at, source_slug)
         VALUES (?, ?, 'pending', ?, ?, ?)`,
        [channelId, email, token, expiresAt, source_slug]
      );
    }

    // Doğrulama maili gönder
    try {
      await sendVerifyMail(email, token, channelName);
    } catch (mailErr) {
      console.error('Subscribe verify mail error:', mailErr);
      // Mail gönderilemese bile sessiz başarı döner (kullanıcıya olumsuz sinyal verme)
    }

    return res.json({ success: 'Abonelik isteği alındı. Lütfen e-postanızı kontrol edin.' });
  } catch (err) {
    console.error('POST /api/subscribe error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * GET /api/subscribe/verify?token=...
 * Double opt-in doğrulama linki — e-posta adresini aktif eder.
 */
router.get('/verify', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('<h2>Geçersiz bağlantı.</h2>');
  }

  try {
    const [rows] = await pool.execute(
      `SELECT id, verify_expires_at FROM subscribers
       WHERE verify_token = ? AND status = 'pending'`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).send('<h2>Bu bağlantı geçersiz veya zaten kullanılmış.</h2>');
    }

    if (new Date() > new Date(rows[0].verify_expires_at)) {
      return res.status(410).send('<h2>Bu bağlantının süresi dolmuş. Lütfen tekrar abone olun.</h2>');
    }

    await pool.execute(
      `UPDATE subscribers
       SET status='active', verified_at=NOW(), verify_token=NULL, verify_expires_at=NULL
       WHERE id=?`,
      [rows[0].id]
    );

    // Başarılı — basit HTML yanıt (ileride özel sayfa yönlendirmesi eklenebilir)
    return res.send(`
      <!DOCTYPE html>
      <html lang="tr">
      <head><meta charset="UTF-8"><title>Abonelik Onaylandı</title>
      <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
      .box{text-align:center;padding:40px;border-radius:12px;background:#f9f9f9;max-width:400px}</style></head>
      <body><div class="box"><h2>✅ Aboneliğiniz onaylandı!</h2>
      <p>Yeni yazılardan haberdar edileceksiniz.</p></div></body></html>
    `);
  } catch (err) {
    console.error('GET /api/subscribe/verify error:', err);
    return res.status(500).send('<h2>Sunucu hatası.</h2>');
  }
});

/**
 * POST /api/unsubscribe
 * Aboneliği iptal eder. Body: { token } veya query: ?token=...
 */
router.post('/unsubscribe', async (req, res) => {
  const token = req.body.token || req.query.token;

  if (!token) {
    return res.status(400).json({ error: 'token gerekli.' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT id FROM subscribers WHERE verify_token = ? OR
       (status = 'active' AND id = (SELECT id FROM subscribers WHERE verify_token = ? LIMIT 1))`,
      [token, token]
    );

    // Token ile eşleşen aktif aboneyi bul (verify_token abone olurken set edilir,
    // aktif aboneler için unsubscribe token olarak da kullanılır)
    const [activeRows] = await pool.execute(
      `SELECT id FROM subscribers WHERE verify_token = ?`,
      [token]
    );

    if (activeRows.length === 0) {
      return res.status(404).json({ error: 'Abonelik bulunamadı.' });
    }

    await pool.execute(
      `UPDATE subscribers SET status='unsubscribed', unsubscribed_at=NOW() WHERE id=?`,
      [activeRows[0].id]
    );

    return res.json({ success: 'Aboneliğiniz iptal edildi.' });
  } catch (err) {
    console.error('POST /api/unsubscribe error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * GET /api/unsubscribe?token=... (e-posta içindeki link için GET desteği)
 */
router.get('/unsubscribe', async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send('<h2>Geçersiz bağlantı.</h2>');
  }

  try {
    const [rows] = await pool.execute(
      `SELECT id FROM subscribers WHERE verify_token = ?`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).send('<h2>Abonelik bulunamadı veya zaten iptal edilmiş.</h2>');
    }

    await pool.execute(
      `UPDATE subscribers SET status='unsubscribed', unsubscribed_at=NOW() WHERE id=?`,
      [rows[0].id]
    );

    return res.send(`
      <!DOCTYPE html>
      <html lang="tr">
      <head><meta charset="UTF-8"><title>Abonelik İptal Edildi</title>
      <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
      .box{text-align:center;padding:40px;border-radius:12px;background:#f9f9f9;max-width:400px}</style></head>
      <body><div class="box"><h2>Aboneliğiniz iptal edildi.</h2>
      <p>Artık bülten almayacaksınız.</p></div></body></html>
    `);
  } catch (err) {
    console.error('GET /api/unsubscribe error:', err);
    return res.status(500).send('<h2>Sunucu hatası.</h2>');
  }
});

module.exports = router;
