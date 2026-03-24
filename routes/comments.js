const express = require('express');
const pool = require('../config/db');
const { honeypotCheck } = require('../middleware/honeypot');
const { commentLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// Geçerli avatar ID aralığı
const AVATAR_MIN = 1;
const AVATAR_MAX = 8;

/**
 * GET /api/comments/:slug
 * Belirli bir makalenin onaylı yorumlarını listeler.
 * api_key query parametresi gerektirir.
 */
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  const { api_key } = req.query;

  if (!api_key) {
    return res.status(400).json({ error: 'api_key gerekli.' });
  }

  try {
    // API key → channel_id doğrulama
    const [channels] = await pool.execute(
      'SELECT id FROM channels WHERE api_key = ?',
      [api_key]
    );
    if (channels.length === 0) {
      return res.status(403).json({ error: 'Geçersiz API Anahtarı.' });
    }
    const channelId = channels[0].id;

    const [rows] = await pool.execute(
      `SELECT id, author_name, avatar_id, content, created_at
       FROM comments
       WHERE article_slug = ? AND channel_id = ? AND status = 'approved'
       ORDER BY created_at ASC`,
      [slug, channelId]
    );

    return res.json({
      article_slug: slug,
      total: rows.length,
      comments: rows
    });
  } catch (err) {
    console.error('GET /api/comments error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * POST /api/comments
 * Yeni yorum gönderir. Pending olarak kaydedilir, admin onayından sonra görünür.
 *
 * Body: { api_key, article_slug, data: { author_name?, author_email?, content, avatar_id?, _hp? } }
 */
router.post('/', commentLimiter, honeypotCheck, async (req, res) => {
  const { api_key, article_slug, data } = req.body;

  if (!api_key || !article_slug || !data) {
    return res.status(400).json({ error: 'api_key, article_slug ve data zorunludur.' });
  }

  const {
    author_name = 'Anonim',
    author_email = null,
    content,
    avatar_id = null,
    _hp  // honeypotCheck middleware zaten kontrol eder ama burada da güvenli ayrıştırma
  } = data;

  // HTML tag sökme — derinlemesine savunma (React display zaten escape eder,
  // ama DB'ye temiz veri yazmak daha güvenli)
  function stripTags(str) {
    return String(str).replace(/<[^>]*>/g, '').trim();
  }

  const cleanContent = stripTags(content);
  const cleanSlug = stripTags(article_slug).slice(0, 300);

  // İçerik doğrulama
  if (!cleanContent || cleanContent.length < 10) {
    return res.status(400).json({ error: 'Yorum en az 10 karakter olmalıdır.' });
  }
  if (cleanContent.length > 2000) {
    return res.status(400).json({ error: 'Yorum en fazla 2000 karakter olabilir.' });
  }

  // Avatar ID doğrulama
  const parsedAvatarId = avatar_id !== null ? parseInt(avatar_id, 10) : null;
  if (parsedAvatarId !== null && (isNaN(parsedAvatarId) || parsedAvatarId < AVATAR_MIN || parsedAvatarId > AVATAR_MAX)) {
    return res.status(400).json({ error: `avatar_id ${AVATAR_MIN}-${AVATAR_MAX} arasında olmalıdır.` });
  }

  // Yazar adı uzunluk + strip kontrolü
  const cleanName = stripTags(author_name).slice(0, 100) || 'Anonim';

  try {
    const [channels] = await pool.execute(
      'SELECT id FROM channels WHERE api_key = ?',
      [api_key]
    );
    if (channels.length === 0) {
      return res.status(403).json({ error: 'Geçersiz API Anahtarı.' });
    }
    const channelId = channels[0].id;
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;

    const [result] = await pool.execute(
      `INSERT INTO comments (article_slug, channel_id, author_name, author_email, content, avatar_id, ip_address, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        cleanSlug,
        channelId,
        cleanName,
        author_email || null,
        cleanContent,
        parsedAvatarId,
        ipAddress
      ]
    );

    return res.status(201).json({
      success: 'Yorumunuz incelemeye alındı.',
      id: result.insertId
    });
  } catch (err) {
    console.error('POST /api/comments error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
