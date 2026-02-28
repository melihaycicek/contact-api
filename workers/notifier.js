/**
 * Email Bildirim Worker'ı
 * cPanel cron job'ı tarafından 1-2 dakikada bir çalıştırılır.
 *
 * Kullanım: node workers/notifier.js
 * Cron örneği: */2 * * * * cd /home/user/contact-api && /usr/bin/node workers/notifier.js >> /home/user/contact-api/logs/notifier.log 2>&1
 */

const nodemailer = require('nodemailer');
const pool = require('../config/db');

// SMTP Transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for others
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const FROM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER;
const FALLBACK_EMAIL = process.env.ADMIN_EMAIL || '';
const BATCH_SIZE = 10; // Her çalışmada max kaç mail

async function run() {
  console.log(`[${new Date().toISOString()}] Notifier worker başlatıldı.`);

  try {
    // 1. notified=0 olan kayıtları bul (en eski önce)
    const [submissions] = await pool.execute(
      `SELECT s.id, s.channel_id, s.form_data, s.ip_address, s.created_at,
              c.channel_name, c.notification_email
       FROM submissions s
       LEFT JOIN channels c ON c.id = s.channel_id
       WHERE s.notified = 0
       ORDER BY s.created_at ASC
       LIMIT ?`,
      [BATCH_SIZE]
    );

    if (submissions.length === 0) {
      console.log('Gönderilecek bildirim yok.');
      process.exit(0);
    }

    console.log(`${submissions.length} adet bildirim gönderilecek.`);

    let successCount = 0;
    let failCount = 0;

    for (const sub of submissions) {
      const toEmail = sub.notification_email || FALLBACK_EMAIL;

      if (!toEmail) {
        console.warn(`Submission #${sub.id}: Bildirim email adresi tanımsız, atlanıyor.`);
        continue;
      }

      try {
        // Form verilerini parse et
        let formData = {};
        try {
          formData = typeof sub.form_data === 'string' ? JSON.parse(sub.form_data) : sub.form_data;
        } catch {}

        const name = formData.name || formData.fullName || formData.ad || 'Bilinmiyor';
        const email = formData.email || formData.mail || formData.eposta || 'Belirtilmemiş';
        const message = formData.message || formData.mesaj || formData.note || JSON.stringify(formData);

        // Mail gönder
        await transporter.sendMail({
          from: `"Contact API" <${FROM_EMAIL}>`,
          to: toEmail,
          subject: `Yeni Form Mesajı – ${sub.channel_name || 'Channel #' + sub.channel_id}`,
          html: buildEmailHtml({
            channelName: sub.channel_name || 'Channel #' + sub.channel_id,
            name,
            email,
            message,
            ip: sub.ip_address,
            date: sub.created_at,
            formData
          })
        });

        // Başarılı → notified=1
        await pool.execute(
          'UPDATE submissions SET notified = 1, notified_at = NOW() WHERE id = ?',
          [sub.id]
        );

        successCount++;
        console.log(`✓ Submission #${sub.id} → ${toEmail}`);

      } catch (mailErr) {
        failCount++;
        console.error(`✗ Submission #${sub.id} mail gönderimi başarısız:`, mailErr.message);
        // notified=0 olarak kalır, sonraki çalışmada tekrar dener
      }
    }

    console.log(`Tamamlandı: ${successCount} başarılı, ${failCount} başarısız.`);

  } catch (error) {
    console.error('Worker hatası:', error);
  }

  process.exit(0);
}

/**
 * Bildirim email HTML şablonu
 */
function buildEmailHtml({ channelName, name, email, message, ip, date, formData }) {
  // Ek alanları listele (name, email, message, _hp hariç)
  const excludeKeys = ['name', 'fullName', 'ad', 'email', 'mail', 'eposta', 'message', 'mesaj', 'note', '_hp'];
  const extraFields = Object.entries(formData)
    .filter(([key]) => !excludeKeys.includes(key))
    .map(([key, val]) => `<tr><td style="padding:6px 12px;color:#666;font-weight:bold;">${escapeHtml(key)}</td><td style="padding:6px 12px;">${escapeHtml(String(val))}</td></tr>`)
    .join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#4f46e5;color:white;padding:20px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">📬 Yeni Form Mesajı</h2>
        <p style="margin:4px 0 0;opacity:0.9;">${escapeHtml(channelName)}</p>
      </div>
      <div style="border:1px solid #e5e7eb;border-top:none;padding:20px;border-radius:0 0 8px 8px;">
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:6px 12px;color:#666;font-weight:bold;">Ad</td><td style="padding:6px 12px;">${escapeHtml(name)}</td></tr>
          <tr style="background:#f9fafb;"><td style="padding:6px 12px;color:#666;font-weight:bold;">Email</td><td style="padding:6px 12px;">${escapeHtml(email)}</td></tr>
          <tr><td style="padding:6px 12px;color:#666;font-weight:bold;">Mesaj</td><td style="padding:6px 12px;">${escapeHtml(message)}</td></tr>
          ${extraFields}
        </table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;">
        <p style="font-size:12px;color:#9ca3af;">IP: ${escapeHtml(ip)} | Tarih: ${date}</p>
      </div>
    </div>
  `;
}

function escapeHtml(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

run();
