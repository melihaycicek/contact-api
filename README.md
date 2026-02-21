# Contact API

Multi-channel contact form backend with admin panel and asynchronous email notifications.

## Features

- **Multi-Channel Support** – Multiple sites can submit forms via API key authentication
- **Admin Panel** – Web-based management for channels, submissions, and notifications
- **Email Notifications** – Asynchronous email delivery via cron worker (doesn't slow down API)
- **Security** – Rate limiting, honeypot spam detection, CORS restrictions, JWT authentication
- **CSV Export** – Export filtered submissions as CSV

## Tech Stack

- **Backend:** Node.js / Express
- **Database:** MySQL
- **Auth:** JWT (JSON Web Tokens)
- **Email:** Nodemailer (SMTP)
- **Frontend:** Vanilla JS SPA + Tailwind CSS (CDN)

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your database, SMTP, and JWT settings
```

### 3. Run Migrations
```bash
npm run migrate
```

### 4. Create Admin User
```bash
npm run seed-admin -- admin YourSecurePassword123
```

### 5. Start Server
```bash
npm start
```

### 6. Access Admin Panel
Open `http://yourdomain.com:3100/admin` in your browser.

## cPanel Cron Setup (Email Notifications)

Add a cron job to run every 2 minutes:
```
*/2 * * * * cd /home/youruser/contact-api && /usr/bin/node workers/notifier.js >> logs/notifier.log 2>&1
```

## Project Structure

```
contact-api/
├── index.js                  # Express app entry point
├── config/
│   └── db.js                 # MySQL pool configuration
├── routes/
│   ├── api.js                # POST /api/submit
│   ├── adminAuth.js          # POST /admin/api/auth/login
│   ├── adminChannels.js      # CRUD /admin/api/channels
│   └── adminSubmissions.js   # CRUD /admin/api/submissions
├── middleware/
│   ├── auth.js               # JWT authentication
│   ├── rateLimit.js          # Rate limiting
│   └── honeypot.js           # Honeypot spam filter
├── workers/
│   └── notifier.js           # Email notification cron worker
├── scripts/
│   ├── migrate.js            # Database migration runner
│   └── seed-admin.js         # Admin user seeder
├── migrations/
│   ├── 001_notification_fields.sql
│   ├── 002_admins_table.sql
│   └── 003_channels_timestamps.sql
├── public/
│   └── admin/                # Admin panel SPA
│       ├── index.html
│       └── js/
└── .env.example
```

## API Endpoints

### Public
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/submit` | Submit a form (rate limited) |
| GET | `/health` | Health check |

### Admin (JWT required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/admin/api/auth/login` | Login, returns JWT |
| POST | `/admin/api/auth/change-password` | Change password |
| GET | `/admin/api/channels` | List all channels |
| POST | `/admin/api/channels` | Create channel |
| PUT | `/admin/api/channels/:id` | Update channel |
| POST | `/admin/api/channels/:id/regenerate-key` | Regenerate API key |
| GET | `/admin/api/submissions` | List submissions (filtered) |
| GET | `/admin/api/submissions/:id` | Submission detail |
| PUT | `/admin/api/submissions/:id/notify` | Mark as notified |
| DELETE | `/admin/api/submissions/:id` | Delete submission |
| GET | `/admin/api/submissions/export` | CSV export |
| GET | `/admin/api/submissions/stats/overview` | Dashboard stats |

## Security

- **CORS**: Configurable via `ALLOWED_ORIGINS` in `.env`
- **Rate Limiting**: 10 req/min for `/api/submit`, 10 req/15min for login
- **Honeypot**: Hidden `_hp` field – bots fill it, humans don't
- **Token Validation**: Optional HMAC-based verification
- **Channel Status**: Inactive channels are automatically rejected

