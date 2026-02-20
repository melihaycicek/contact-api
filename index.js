const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware: Farklı originlerden (aycicek.web.app gibi) gelen isteklere izin ver
app.use(cors());
app.use(express.json());

// MySQL Bağlantı Havuzu (Performans için pool kullanıyoruz)
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Merkezi Kayıt ve Doğrulama Endpoint'i
app.post('/api/submit', async (req, res) => {
    const { api_key, data, verification_token } = req.body;

    try {
        // 1. Kanal (Site) Doğrulaması
        const [channels] = await pool.execute(
            'SELECT id FROM channels WHERE api_key = ?', 
            [api_key]
        );

        if (channels.length === 0) {
            return res.status(403).json({ error: "Geçersiz API Anahtarı. Erişim engellendi." });
        }

        // 2. Güvenlik Doğrulaması (SteadyHand Token Kontrolü)
        if (!verification_token) {
            return res.status(400).json({ error: "Güvenlik doğrulaması (SteadyHand) tamamlanmadı." });
        }

        // 3. Verileri MySQL'e Kaydet (JSON formatında)
        const channelId = channels[0].id;
        const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

        const query = `
            INSERT INTO submissions (channel_id, form_data, ip_address, is_verified) 
            VALUES (?, ?, ?, ?)
        `;

        await pool.execute(query, [
            channelId, 
            JSON.stringify(data), // Formdan gelen tüm alanları JSON olarak sakla
            ipAddress, 
            true
        ]);

        return res.status(200).json({ success: "Mesajınız başarıyla kaydedildi." });

    } catch (error) {
        console.error("Sistem Hatası:", error);
        return res.status(500).json({ error: "Sunucu tarafında bir hata oluştu." });
    }
});

// Port Dinleme (cPanel'de belirlediğin port)
const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
    console.log(`Backend ${PORT} portunda aktif. Node.js ${process.version}`);
});