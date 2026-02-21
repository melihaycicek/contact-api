const express = require('express');
const crypto = require('crypto');
const pool = require('../config/db');

const router = express.Router();

/**
 * GET /admin/channels
 * Tüm kanalları listele
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, domain, api_key, status, notification_email, created_at FROM channels ORDER BY created_at DESC'
    );
    return res.json(rows);
  } catch (error) {
    console.error('Channels listesi hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * POST /admin/channels
 * Yeni channel oluştur
 */
router.post('/', async (req, res) => {
  const { name, domain, notification_email } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Channel adı gereklidir.' });
  }

  const apiKey = generateApiKey();

  try {
    const [result] = await pool.execute(
      'INSERT INTO channels (name, domain, api_key, status, notification_email) VALUES (?, ?, ?, ?, ?)',
      [name, domain || null, apiKey, 'active', notification_email || null]
    );

    return res.status(201).json({
      id: result.insertId,
      name,
      domain,
      api_key: apiKey,
      status: 'active',
      notification_email
    });
  } catch (error) {
    console.error('Channel oluşturma hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * PUT /admin/channels/:id
 * Channel güncelle
 */
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, domain, status, notification_email } = req.body;

  try {
    const fields = [];
    const values = [];

    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (domain !== undefined) { fields.push('domain = ?'); values.push(domain); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (notification_email !== undefined) { fields.push('notification_email = ?'); values.push(notification_email); }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'Güncellenecek alan belirtilmedi.' });
    }

    values.push(id);
    await pool.execute(`UPDATE channels SET ${fields.join(', ')} WHERE id = ?`, values);

    return res.json({ success: 'Channel güncellendi.' });
  } catch (error) {
    console.error('Channel güncelleme hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * POST /admin/channels/:id/regenerate-key
 * API key yenile
 */
router.post('/:id/regenerate-key', async (req, res) => {
  const { id } = req.params;
  const newKey = generateApiKey();

  try {
    const [result] = await pool.execute(
      'UPDATE channels SET api_key = ? WHERE id = ?',
      [newKey, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Channel bulunamadı.' });
    }

    return res.json({ api_key: newKey });
  } catch (error) {
    console.error('Key regenerate hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * Güvenli random API key üretici
 */
function generateApiKey() {
  return 'ch_' + crypto.randomBytes(24).toString('hex');
}

module.exports = router;
