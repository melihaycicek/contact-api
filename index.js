const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const app = express();

// cPanel / LiteSpeed reverse proxy arkasında çalıştığı için gerekli
app.set('trust proxy', 1);

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

// --- Statik dosyalar: Admin Panel ---
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));

// --- Routes ---
const apiRoutes = require('./routes/api');
const adminAuthRoutes = require('./routes/adminAuth');
const adminChannelRoutes = require('./routes/adminChannels');
const adminSubmissionRoutes = require('./routes/adminSubmissions');
const { authMiddleware } = require('./middleware/auth');

// Public API
app.use('/api', apiRoutes);

// Admin API – login hariç hepsi JWT korumalı
app.use('/admin/api/auth', adminAuthRoutes);
app.use('/admin/api/channels', authMiddleware, adminChannelRoutes);
app.use('/admin/api/submissions', authMiddleware, adminSubmissionRoutes);

// Admin SPA fallback – tüm admin/* route'larını index.html'e yönlendir
app.get('/admin/*', (req, res) => {
  // API çağrılarını fallback'e düşürme
  if (req.path.startsWith('/admin/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'admin', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Port Dinleme ---
const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
  console.log(`Backend ${PORT} portunda aktif. Node.js ${process.version}`);
});