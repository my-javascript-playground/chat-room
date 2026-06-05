# chatroom — Frontend

Next.js 14 frontend for the real-time chatroom application.

## Requirements

- Node.js 18+
- npm 9+
- Backend server running (see `../backend/README.md`)

## Installation

```bash
npm install
```

Copy the example environment file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# URL of the backend server
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080

# reCAPTCHA v2 site key (optional — leave blank to disable CAPTCHA)
# Get a key pair at https://www.google.com/recaptcha/admin
# Choose "reCAPTCHA v2 → I'm not a robot Checkbox"
# Add "localhost" to allowed domains for local dev
NEXT_PUBLIC_RECAPTCHA_SITE_KEY=
```

## Usage

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Production build

```bash
npm run build
npm run start
```

## Features

- **Authentication** — Login and registration with JWT-based sessions. Accounts require admin approval before access is granted.
- **reCAPTCHA v2** — "I'm not a robot" checkbox on both the login and register screens when a site key is configured. Leave `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` blank to disable entirely (useful for local dev).
- **Real-time messaging** — Socket.IO powered chat with instant delivery.
- **Multiple rooms** — Switch between rooms, request to join new ones, and leave rooms you no longer need. The *General* room is permanent.
- **@mentions** — Type `@username` to mention someone; they receive a toast notification.
- **Direct messages** — Click any online user (or any user with prior DM history) to open a private panel.
- **Presence status** — Set yourself as Online, Away, or Offline. Other users' dots update in real time.
- **Unread badges** — Per-room and per-DM unread counters.
- **Admin panel** — Approve/deny registrations, manage users and rooms (admin accounts only).
- **Change password** — Users can update their own password at any time.
- **Persistent session** — Session is saved to `localStorage`/`sessionStorage` so a page refresh keeps you logged in.

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Yes | Full URL of the NestJS backend, e.g. `http://localhost:8080` |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | No | reCAPTCHA v2 site key. Omit or leave blank to disable CAPTCHA. |
