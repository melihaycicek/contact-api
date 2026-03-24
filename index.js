const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Log dizini
const LOG_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

function writeLog(filename, msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(path.join(LOG_DIR, filename), line);
    process.stdout.write(line);
}

process.on('uncaughtException', (err) => {
    writeLog('crash.log', `UNCAUGHT EXCEPTION: ${err.stack || err}`);
    process.exit(1);
});
process.on('unhandledRejection', (reason) => {
    writeLog('crash.log', `UNHANDLED REJECTION: ${reason?.stack || reason}`);
});

const app = express();

// cPanel / LiteSpeed reverse proxy arkasında çalıştığı için gerekli
app.set('trust proxy', 1);

// Helmet — HTTP güvenlik başlıkları
// contentSecurityPolicy: Admin statik HTML'de inline script olabilir → kapalı
app.use(helmet({
  contentSecurityPolicy:     false,
  crossOriginEmbedderPolicy: false,
}));

// --- CORS Ayarları ---
// İzin verilen originler (.env'den veya varsayılan)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // origin olmayan istekler (curl, cron, server-to-server) veya admin panel
    if (!origin) return callback(null, true);
    // İzin listesi boşsa herkese izin ver (geriye uyumluluk)
    if (allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS policy: Bu origin\'e izin verilmiyor.'));
  },
  credentials: true
}));

app.use(express.json());

// --- Ters Proxy Doğrulama: Admin rotaları ---
// Apache/LiteSpeed proxy tüm /contact-api/admin isteklerine X-Internal-Token header'ı ekler.
// Node.js portuna (3100) doğrudan dışarıdan erişim bu kontrol sayesinde reddedilir.
// INTERNAL_TOKEN .env'de boşsa kontrol devre dışı (geliştirme ortamı için).
app.use('/contact-api/admin', (req, res, next) => {
  const secret = process.env.INTERNAL_TOKEN;
  if (secret && req.headers['x-internal-token'] !== secret) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// --- Statik dosyalar: Admin Panel + Widget ---
app.use('/contact-api/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use('/contact-api/widget', express.static(path.join(__dirname, 'public', 'widget')));

// --- Routes ---
const apiRoutes = require('./routes/api');
const commentRoutes = require('./routes/comments');
const reactionRoutes = require('./routes/reactions');
const subscribeRoutes = require('./routes/subscribe');
const adminAuthRoutes = require('./routes/adminAuth');
const adminChannelRoutes = require('./routes/adminChannels');
const adminSubmissionRoutes = require('./routes/adminSubmissions');
const adminCommentRoutes = require('./routes/adminComments');
const adminReactionRoutes = require('./routes/adminReactions');
const adminSubscriberRoutes = require('./routes/adminSubscribers');
const { authMiddleware } = require('./middleware/auth');

// Public API
app.use('/contact-api/api', apiRoutes);
app.use('/contact-api/api/comments', commentRoutes);
app.use('/contact-api/api/reactions', reactionRoutes);
app.use('/contact-api/api', subscribeRoutes);   // /contact-api/api/subscribe, /contact-api/api/unsubscribe

// Admin API – login hariç hepsi JWT korumalı
app.use('/contact-api/admin/api/auth', adminAuthRoutes);
app.use('/contact-api/admin/api/channels', authMiddleware, adminChannelRoutes);
app.use('/contact-api/admin/api/submissions', authMiddleware, adminSubmissionRoutes);
app.use('/contact-api/admin/api/comments', authMiddleware, adminCommentRoutes);
app.use('/contact-api/admin/api/reactions', authMiddleware, adminReactionRoutes);
app.use('/contact-api/admin/api/subscribers', authMiddleware, adminSubscriberRoutes);

// Admin SPA fallback – tüm contact-api/admin/* route'larını index.html'e yönlendir
app.get('/contact-api/admin/*', (req, res) => {
  // API çağrılarını fallback'e düşürme
  if (req.path.startsWith('/contact-api/admin/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// HTTP request logging
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        writeLog('access.log', `${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms - ${req.headers.origin || '-'}`);
    });
    next();
});

// --- Port Dinleme ---
const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
    writeLog('access.log', `Backend ${PORT} portunda aktif. Node.js ${process.version}`);
    console.log(`Backend ${PORT} portunda aktif. Node.js ${process.version}`);
});