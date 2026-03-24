const express = require('express');
const pool = require('../config/db');

const router = express.Router();

/**
 * GET /admin/api/subscribers
 * Bülten abonelerini listeler.
 * Query: channel_id, status, page, limit
 */
router.get('/', async (req, res) => {
  const { channel_id, status, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const conditions = [];
  const params = [];

  if (channel_id) { conditions.push('s.channel_id = ?'); params.push(parseInt(channel_id)); }
  if (status && ['pending', 'active', 'unsubscribed'].includes(status)) {
    conditions.push('s.status = ?');
    params.push(status);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  try {
    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM subscribers s ${where}`,
      params
    );

    const [rows] = await pool.execute(
      `SELECT s.id, s.email, s.status, s.source_slug, s.created_at, s.verified_at, s.unsubscribed_at,
              ch.channel_name
       FROM subscribers s
       LEFT JOIN channels ch ON ch.id = s.channel_id
       ${where}
       ORDER BY s.created_at DESC
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
    console.error('GET /admin/api/subscribers error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * GET /admin/api/subscribers/export
 * Aktif aboneleri CSV olarak indirir.
 */
router.get('/export', async (req, res) => {
  const { channel_id } = req.query;
  const conditions = [`s.status = 'active'`];
  const params = [];

  if (channel_id) { conditions.push('s.channel_id = ?'); params.push(parseInt(channel_id)); }

  const where = 'WHERE ' + conditions.join(' AND ');

  try {
    const [rows] = await pool.execute(
      `SELECT s.email, ch.channel_name, s.source_slug, s.verified_at, s.created_at
       FROM subscribers s
       LEFT JOIN channels ch ON ch.id = s.channel_id
       ${where}
       ORDER BY s.verified_at DESC`,
      params
    );

    const BOM = '\uFEFF';
    const header = 'Email,Channel,Source,Verified At,Subscribed At\n';
    const csvRows = rows.map(r => [
      `"${r.email}"`,
      `"${r.channel_name || ''}"`,
      `"${r.source_slug || ''}"`,
      `"${r.verified_at ? new Date(r.verified_at).toISOString() : ''}"`,
      `"${new Date(r.created_at).toISOString()}"`
    ].join(','));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="subscribers_export.csv"');
    return res.send(BOM + header + csvRows.join('\n'));
  } catch (err) {
    console.error('GET /admin/api/subscribers/export error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * DELETE /admin/api/subscribers/:id
 * Aboneyi sil
 */
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM subscribers WHERE id = ?',
      [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Abone bulunamadı.' });
    return res.json({ success: 'Abone silindi.' });
  } catch (err) {
    console.error('DELETE /admin/api/subscribers/:id error:', err);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
