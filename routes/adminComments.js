const express = require('express');
const pool = require('../config/db');

const router = express.Router();

/**
 * GET /admin/api/comments
 * Filtreli ve sayfalanmış yorum listesi.
 * Query: status, article_slug, channel_id, page, limit
 */
router.get('/', async (req, res) => {
  const {
    status,
    article_slug,
    channel_id,
    page = 1,
    limit = 50
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const conditions = [];
  const params = [];

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    conditions.push('c.status = ?');
    params.push(status);
  }
  if (article_slug) {
    conditions.push('c.article_slug = ?');
    params.push(article_slug);
  }
  if (channel_id) {
    conditions.push('c.channel_id = ?');
    params.push(parseInt(channel_id));
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM comments c ${where}`,
      params
    );

    const [rows] = await pool.execute(
      `SELECT c.id, c.article_slug, c.channel_id, ch.channel_name,
              c.author_name, c.author_email, c.avatar_id,
              c.content, c.ip_address, c.status, c.created_at
       FROM comments c
       LEFT JOIN channels ch ON ch.id = c.channel_id
       ${where}
       ORDER BY c.created_at DESC
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
    console.error('GET /admin/api/comments error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * GET /admin/api/comments/:id
 * Tek yorum detayı
 */
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT c.*, ch.channel_name
       FROM comments c
       LEFT JOIN channels ch ON ch.id = c.channel_id
       WHERE c.id = ?`,
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Yorum bulunamadı.' });
    return res.json(rows[0]);
  } catch (err) {
    console.error('GET /admin/api/comments/:id error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * PUT /admin/api/comments/:id/approve
 * Yorumu onayla — status: 'approved'
 */
router.put('/:id/approve', async (req, res) => {
  try {
    const [result] = await pool.execute(
      `UPDATE comments SET status = 'approved' WHERE id = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Yorum bulunamadı.' });
    return res.json({ success: 'Yorum onaylandı.' });
  } catch (err) {
    console.error('PUT /admin/api/comments/:id/approve error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * PUT /admin/api/comments/:id/reject
 * Yorumu reddet — status: 'rejected'
 */
router.put('/:id/reject', async (req, res) => {
  try {
    const [result] = await pool.execute(
      `UPDATE comments SET status = 'rejected' WHERE id = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Yorum bulunamadı.' });
    return res.json({ success: 'Yorum reddedildi.' });
  } catch (err) {
    console.error('PUT /admin/api/comments/:id/reject error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * DELETE /admin/api/comments/:id
 * Yorumu kalıcı olarak sil
 */
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM comments WHERE id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Yorum bulunamadı.' });
    return res.json({ success: 'Yorum silindi.' });
  } catch (err) {
    console.error('DELETE /admin/api/comments/:id error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
