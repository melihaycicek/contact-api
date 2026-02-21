const rateLimit = require('express-rate-limit');

/**
 * /api/submit endpoint'i için rate limiter
 * Her IP adresi dakikada en fazla 10 istek atabilir
 */
const submitLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 dakika
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.'
  }
});

/**
 * Admin login için rate limiter
 * Her IP adresi 15 dakikada en fazla 10 deneme yapabilir
 */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.'
  }
});

module.exports = { submitLimiter, loginLimiter };
