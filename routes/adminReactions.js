const express = require('express');
const pool = require('../config/db');

const router = express.Router();

/**
 * GET /admin/api/reactions/stats
 * Makale bazlı reaction istatistikleri.
 * Query: channel_id, reaction_type, limit (varsayılan: 20, en popüler)
 */
router.get('/stats', async (req, res) => {
  const { channel_id, reaction_type, limit = 20 } = req.query;

  const conditions = [];
  const params = [];

  if (channel_id) {
    conditions.push('r.channel_id = ?');
    params.push(parseInt(channel_id));
  }
  if (reaction_type) {
    conditions.push('r.reaction_type = ?');
    params.push(reaction_type);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const [rows] = await pool.execute(
      `SELECT r.article_slug, r.reaction_type, ch.channel_name,
              SUM(r.count) AS total,
              COUNT(DISTINCT r.fingerprint) AS unique_users,
              MAX(r.updated_at) AS last_reaction_at
       FROM reactions r
       LEFT JOIN channels ch ON ch.id = r.channel_id
       ${where}
       GROUP BY r.article_slug, r.reaction_type, r.channel_id
       ORDER BY total DESC
       LIMIT ?`,
      [...params, parseInt(limit)]
    );

    return res.json({ data: rows });
  } catch (err) {
    console.error('GET /admin/api/reactions/stats error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * GET /admin/api/reactions
 * Ham reaction kayıtları (sayfalı)
 * Query: channel_id, article_slug, reaction_type, page, limit
 */
router.get('/', async (req, res) => {
  const { channel_id, article_slug, reaction_type, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [];
  const params = [];

  if (channel_id) { conditions.push('channel_id = ?'); params.push(parseInt(channel_id)); }
  if (article_slug) { conditions.push('article_slug = ?'); params.push(article_slug); }
  if (reaction_type) { conditions.push('reaction_type = ?'); params.push(reaction_type); }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM reactions ${where}`,
      params
    );

    const [rows] = await pool.execute(
      `SELECT id, article_slug, channel_id, reaction_type, count, created_at, updated_at
       FROM reactions ${where}
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    return res.json({
      data: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (err) {
    console.error('GET /admin/api/reactions error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
