const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');
const { honeypotCheck } = require('../middleware/honeypot');
const { submitLimiter } = require('../middleware/rateLimit');

const router = express.Router();

/**
 * POST /api/submit
 * Merkezi form kayıt endpoint'i – güvenlik katmanları eklenmiş
 */
router.post('/submit', submitLimiter, honeypotCheck, async (req, res) => {
  const { api_key, data, verification_token } = req.body;

  try {
    // 1. API Key doğrulama + channel aktiflik kontrolü
    const [channels] = await pool.execute(
      'SELECT id, notification_email FROM channels WHERE api_key = ? AND status = ?',
      [api_key, 'active']
    );

    if (channels.length === 0) {
      return res.status(403).json({ error: 'Geçersiz API Anahtarı veya devre dışı kanal.' });
    }

    // 2. Verification token kontrolü
    if (!verification_token) {
      return res.status(400).json({ error: 'Güvenlik doğrulaması (SteadyHand) tamamlanmadı.' });
    }

    // 3. Basit token doğrulama (HMAC tabanlı)
    // Token formatı: timestamp.hash
    // Frontend timestamp + api_key ile HMAC üretir, backend doğrular
    if (process.env.TOKEN_SECRET) {
      const isValid = verifyToken(verification_token, api_key);
      if (!isValid) {
        return res.status(400).json({ error: 'Güvenlik doğrulaması başarısız.' });
      }
    }

    // 4. Verileri MySQL'e kaydet
    const channelId = channels[0].id;
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    const query = `
      INSERT INTO submissions (channel_id, form_data, ip_address, is_verified, notified)
      VALUES (?, ?, ?, ?, 0)
    `;

    await pool.execute(query, [
      channelId,
      JSON.stringify(data),
      ipAddress,
      true
    ]);

    return res.status(200).json({ success: 'Mesajınız başarıyla kaydedildi.' });

  } catch (error) {
    console.error('Sistem Hatası:', error);
    return res.status(500).json({ error: 'Sunucu tarafında bir hata oluştu.' });
  }
});

/**
 * HMAC tabanlı basit token doğrulama
 * Frontend tarafında üretilecek: timestamp + HMAC(timestamp + api_key, TOKEN_SECRET)
 */
function verifyToken(token, apiKey) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;

    const [timestamp, hash] = parts;
    const now = Date.now();
    const tokenTime = parseInt(timestamp, 10);

    // Token 5 dakikadan eski mi?
    if (now - tokenTime > 5 * 60 * 1000) return false;

    // HMAC doğrulama
    const expected = crypto
      .createHmac('sha256', process.env.TOKEN_SECRET)
      .update(timestamp + apiKey)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expected));
  } catch {
    return false;
  }
}

module.exports = router;
