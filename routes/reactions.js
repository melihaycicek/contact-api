const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');
const { reactionLimiter } = require('../middleware/rateLimit');

const router = express.Router();

const VALID_TYPES = ['clap', 'like', 'heart'];
const MAX_COUNT_PER_USER = 50;

/**
 * Fingerprint üretici: IP + User-Agent'ın SHA-256 hash'i
 * Tamamen anonim; geriye IP veya kişisel veri saklanmaz.
 */
function makeFingerprint(req) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '';
  const ua = req.headers['user-agent'] || '';
  return crypto.createHash('sha256').update(ip + ua).digest('hex');
}

/**
 * GET /api/reactions/:slug
 * Makalenin toplam reaction sayılarını ve mevcut kullanıcının sayısını döner.
 * api_key query parametresi gerektirir.
 */
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  const { api_key } = req.query;

  if (!api_key) {
    return res.status(400).json({ error: 'api_key gerekli.' });
  }

  try {
    const [channels] = await pool.execute(
      'SELECT id FROM channels WHERE api_key = ?',
      [api_key]
    );
    if (channels.length === 0) {
      return res.status(403).json({ error: 'Geçersiz API Anahtarı.' });
    }
    const channelId = channels[0].id;
    const fingerprint = makeFingerprint(req);

    // Toplam sayılar
    const [totals] = await pool.execute(
      `SELECT reaction_type, SUM(count) AS total
       FROM reactions
       WHERE article_slug = ? AND channel_id = ?
       GROUP BY reaction_type`,
      [slug, channelId]
    );

    // Kullanıcının kendi sayıları
    const [userRows] = await pool.execute(
      `SELECT reaction_type, count
       FROM reactions
       WHERE article_slug = ? AND channel_id = ? AND fingerprint = ?`,
      [slug, channelId, fingerprint]
    );

    const reactions = {};
    totals.forEach(r => { reactions[r.reaction_type] = Number(r.total); });

    const user_reaction = {};
    userRows.forEach(r => { user_reaction[r.reaction_type] = r.count; });

    return res.json({ article_slug: slug, reactions, user_reaction });
  } catch (err) {
    console.error('GET /api/reactions error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * POST /api/reactions
 * Clap / like ekler veya günceller. Fingerprint ile tekil kullanıcı tespiti.
 *
 * Body: { api_key, article_slug, reaction_type, count }
 * count: bu etkileşimde eklenmek istenen miktar (1-10 arası önerilir; kümülatif max 50)
 */
router.post('/', reactionLimiter, async (req, res) => {
  const { api_key, article_slug, reaction_type = 'clap', count = 1 } = req.body;

  if (!api_key || !article_slug) {
    return res.status(400).json({ error: 'api_key ve article_slug zorunludur.' });
  }

  if (!VALID_TYPES.includes(reaction_type)) {
    return res.status(400).json({ error: `reaction_type şunlardan biri olmalı: ${VALID_TYPES.join(', ')}` });
  }

  const parsedCount = parseInt(count, 10);
  if (isNaN(parsedCount) || parsedCount < 1 || parsedCount > 10) {
    return res.status(400).json({ error: 'count 1-10 arasında olmalıdır.' });
  }

  try {
    const [channels] = await pool.execute(
      'SELECT id FROM channels WHERE api_key = ?',
      [api_key]
    );
    if (channels.length === 0) {
      return res.status(403).json({ error: 'Geçersiz API Anahtarı.' });
    }
    const channelId = channels[0].id;
    const fingerprint = makeFingerprint(req);

    // UPSERT: mevcut kayıt varsa count'u artır, yoksa yeni kayıt oluştur
    // LEAST ile kişi başı maksimum 50 sınırı uygulanır
    await pool.execute(
      `INSERT INTO reactions (article_slug, channel_id, reaction_type, fingerprint, count)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         count = LEAST(count + VALUES(count), ?),
         updated_at = NOW()`,
      [article_slug, channelId, reaction_type, fingerprint, parsedCount, MAX_COUNT_PER_USER]
    );

    // Güncel toplam ve kullanıcı sayısını döndür
    const [[totalRow]] = await pool.execute(
      `SELECT COALESCE(SUM(count), 0) AS total
       FROM reactions
       WHERE article_slug = ? AND channel_id = ? AND reaction_type = ?`,
      [article_slug, channelId, reaction_type]
    );

    const [[userRow]] = await pool.execute(
      `SELECT COALESCE(count, 0) AS your_count
       FROM reactions
       WHERE article_slug = ? AND channel_id = ? AND reaction_type = ? AND fingerprint = ?`,
      [article_slug, channelId, reaction_type, fingerprint]
    );

    return res.json({
      [`total_${reaction_type}s`]: Number(totalRow.total),
      [`your_${reaction_type}s`]: Number(userRow.your_count)
    });
  } catch (err) {
    console.error('POST /api/reactions error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * DELETE /api/reactions
 * Kullanıcının bir reaction'ını kaldırır (toggle off).
 *
 * Body: { api_key, article_slug, reaction_type }
 */
router.delete('/', async (req, res) => {
  const { api_key, article_slug, reaction_type } = req.body;

  if (!api_key || !article_slug) {
    return res.status(400).json({ error: 'api_key ve article_slug zorunludur.' });
  }

  if (!VALID_TYPES.includes(reaction_type)) {
    return res.status(400).json({ error: `reaction_type şunlardan biri olmalı: ${VALID_TYPES.join(', ')}` });
  }

  try {
    const [channels] = await pool.execute(
      'SELECT id FROM channels WHERE api_key = ?',
      [api_key]
    );
    if (channels.length === 0) {
      return res.status(403).json({ error: 'Geçersiz API Anahtarı.' });
    }
    const channelId = channels[0].id;
    const fingerprint = makeFingerprint(req);

    await pool.execute(
      `DELETE FROM reactions
       WHERE article_slug = ? AND channel_id = ? AND reaction_type = ? AND fingerprint = ?`,
      [article_slug, channelId, reaction_type, fingerprint]
    );

    const [[totalRow]] = await pool.execute(
      `SELECT COALESCE(SUM(count), 0) AS total
       FROM reactions
       WHERE article_slug = ? AND channel_id = ? AND reaction_type = ?`,
      [article_slug, channelId, reaction_type]
    );

    return res.json({
      [`total_${reaction_type}s`]: Number(totalRow.total),
      [`your_${reaction_type}s`]: 0
    });
  } catch (err) {
    console.error('DELETE /api/reactions error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
