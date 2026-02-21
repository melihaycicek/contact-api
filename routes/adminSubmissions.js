const express = require('express');
const pool = require('../config/db');

const router = express.Router();

/**
 * GET /admin/submissions
 * Filtreli submissions listesi
 * Query params: channel_id, from, to, notified, keyword, page, limit
 */
router.get('/', async (req, res) => {
  try {
    const {
      channel_id,
      from,
      to,
      notified,
      keyword,
      page = 1,
      limit = 50
    } = req.query;

    let where = ['1=1'];
    let params = [];

    if (channel_id) {
      where.push('s.channel_id = ?');
      params.push(channel_id);
    }

    if (from) {
      where.push('s.created_at >= ?');
      params.push(from);
    }

    if (to) {
      where.push('s.created_at <= ?');
      params.push(to + ' 23:59:59');
    }

    if (notified !== undefined && notified !== '') {
      where.push('s.notified = ?');
      params.push(parseInt(notified));
    }

    if (keyword) {
      where.push('s.form_data LIKE ?');
      params.push(`%${keyword}%`);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Toplam sayı
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM submissions s WHERE ${where.join(' AND ')}`,
      params
    );

    // Kayıtlar
    const [rows] = await pool.execute(
      `SELECT s.id, s.channel_id, c.name as channel_name, s.form_data, s.ip_address,
              s.is_verified, s.notified, s.notified_at, s.created_at
       FROM submissions s
       LEFT JOIN channels c ON c.id = s.channel_id
       WHERE ${where.join(' AND ')}
       ORDER BY s.created_at DESC
       LIMIT ${parseInt(limit)} OFFSET ${offset}`,
      params
    );

    // JSON form_data'dan name/email/message çıkar
    const normalized = rows.map(row => {
      let parsed = {};
      try {
        parsed = typeof row.form_data === 'string' ? JSON.parse(row.form_data) : row.form_data;
      } catch {}

      return {
        ...row,
        form_data: parsed,
        name: parsed.name || parsed.fullName || parsed.ad || '-',
        email: parsed.email || parsed.mail || parsed.eposta || '-',
        message: parsed.message || parsed.mesaj || parsed.note || '-'
      };
    });

    return res.json({
      data: normalized,
      pagination: {
        total: countResult[0].total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(countResult[0].total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Submissions listesi hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * GET /admin/submissions/export
 * CSV export (filtreli)
 */
router.get('/export', async (req, res) => {
  try {
    const { channel_id, from, to, notified, keyword } = req.query;

    let where = ['1=1'];
    let params = [];

    if (channel_id) { where.push('s.channel_id = ?'); params.push(channel_id); }
    if (from) { where.push('s.created_at >= ?'); params.push(from); }
    if (to) { where.push('s.created_at <= ?'); params.push(to + ' 23:59:59'); }
    if (notified !== undefined && notified !== '') { where.push('s.notified = ?'); params.push(parseInt(notified)); }
    if (keyword) { where.push('s.form_data LIKE ?'); params.push(`%${keyword}%`); }

    const [rows] = await pool.execute(
      `SELECT s.id, c.name as channel_name, s.form_data, s.ip_address,
              s.notified, s.notified_at, s.created_at
       FROM submissions s
       LEFT JOIN channels c ON c.id = s.channel_id
       WHERE ${where.join(' AND ')}
       ORDER BY s.created_at DESC`,
      params
    );

    // CSV oluştur
    const csvRows = ['ID,Channel,Name,Email,Message,IP,Notified,Created At'];
    for (const row of rows) {
      let parsed = {};
      try { parsed = typeof row.form_data === 'string' ? JSON.parse(row.form_data) : row.form_data; } catch {}

      const name = (parsed.name || parsed.fullName || '').replace(/"/g, '""');
      const email = (parsed.email || parsed.mail || '').replace(/"/g, '""');
      const message = (parsed.message || parsed.mesaj || '').replace(/"/g, '""');

      csvRows.push(
        `${row.id},"${row.channel_name || ''}","${name}","${email}","${message}","${row.ip_address}",${row.notified},"${row.created_at}"`
      );
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=submissions_export.csv');
    return res.send('\uFEFF' + csvRows.join('\n')); // BOM for Excel UTF-8

  } catch (error) {
    console.error('CSV export hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * GET /admin/submissions/:id
 * Submission detayı – full JSON + meta
 */
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT s.*, c.name as channel_name, c.domain as channel_domain
       FROM submissions s
       LEFT JOIN channels c ON c.id = s.channel_id
       WHERE s.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    }

    const row = rows[0];
    let parsed = {};
    try { parsed = typeof row.form_data === 'string' ? JSON.parse(row.form_data) : row.form_data; } catch {}

    return res.json({
      ...row,
      form_data: parsed
    });
  } catch (error) {
    console.error('Submission detay hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * PUT /admin/submissions/:id/notify
 * Manuel olarak notified=1 işaretle
 */
router.put('/:id/notify', async (req, res) => {
  try {
    await pool.execute(
      'UPDATE submissions SET notified = 1, notified_at = NOW() WHERE id = ?',
      [req.params.id]
    );
    return res.json({ success: 'Bildirim durumu güncellendi.' });
  } catch (error) {
    console.error('Notify güncelleme hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * DELETE /admin/submissions/:id
 * Submission silme (GDPR / temizlik)
 */
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM submissions WHERE id = ?',
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Kayıt bulunamadı.' });
    }

    return res.json({ success: 'Kayıt silindi.' });
  } catch (error) {
    console.error('Submission silme hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * GET /admin/submissions/stats
 * Dashboard istatistikleri
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const [total] = await pool.execute('SELECT COUNT(*) as count FROM submissions');
    const [unnotified] = await pool.execute('SELECT COUNT(*) as count FROM submissions WHERE notified = 0');
    const [today] = await pool.execute(
      'SELECT COUNT(*) as count FROM submissions WHERE DATE(created_at) = CURDATE()'
    );
    const [channelCount] = await pool.execute('SELECT COUNT(*) as count FROM channels WHERE status = ?', ['active']);

    return res.json({
      totalSubmissions: total[0].count,
      unnotifiedSubmissions: unnotified[0].count,
      todaySubmissions: today[0].count,
      activeChannels: channelCount[0].count
    });
  } catch (error) {
    console.error('Stats hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
