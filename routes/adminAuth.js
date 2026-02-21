const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { JWT_SECRET, JWT_EXPIRES } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

/**
 * POST /admin/login
 * Admin girişi → JWT token döndürür
 */
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre gereklidir.' });
  }

  try {
    const [admins] = await pool.execute(
      'SELECT id, username, password_hash FROM admins WHERE username = ?',
      [username]
    );

    if (admins.length === 0) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre.' });
    }

    const admin = admins[0];
    const isMatch = await bcrypt.compare(password, admin.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre.' });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    return res.json({ token, username: admin.username });

  } catch (error) {
    console.error('Login hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

/**
 * POST /admin/change-password
 * Admin şifre değiştir
 */
router.post('/change-password', async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'Geçerli şifre ve en az 6 karakter yeni şifre gereklidir.' });
  }

  try {
    const [admins] = await pool.execute(
      'SELECT id, password_hash FROM admins WHERE id = ?',
      [req.admin.id]
    );

    if (admins.length === 0) {
      return res.status(404).json({ error: 'Admin bulunamadı.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admins[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Mevcut şifre yanlış.' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE admins SET password_hash = ? WHERE id = ?', [hash, req.admin.id]);

    return res.json({ success: 'Şifre başarıyla değiştirildi.' });

  } catch (error) {
    console.error('Şifre değiştirme hatası:', error);
    return res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
