# chatroom — Backend

NestJS + Socket.IO backend for the real-time chatroom application. Uses SQLite via `better-sqlite3` for persistence and JWT for authentication.

## Requirements

- Node.js 18+
- npm 9+

## Installation

```bash
npm install
```

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

Edit `.env`:

```env
PORT=8080
JWT_SECRET=change_me_in_production

# SQLite database file path (created automatically on first run)
DB_PATH=./chatroom.db

# Credentials for the built-in admin account (created on first run)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123

# reCAPTCHA v2 secret key (optional — leave blank to disable verification)
# Must match the site key used in the frontend.
# Get a key pair at https://www.google.com/recaptcha/admin
RECAPTCHA_SECRET_KEY=
```

> **Security note:** Always set a strong `JWT_SECRET` and non-default `ADMIN_PASSWORD` before deploying to production.

## Usage

### Development (watch mode)

```bash
npm run start:dev
```

### Production

```bash
npm run build
npm run start
```

The server listens on the port set in `PORT` (default `8080`).

## Features

- **JWT authentication** — Stateless tokens issued on login; verified on every HTTP request and WebSocket connection.
- **User registration with approval** — New accounts start in `pending` state; an admin must approve them before the user can log in.
- **reCAPTCHA v2 verification** — Both login and registration endpoints verify the CAPTCHA token against Google's API when `RECAPTCHA_SECRET_KEY` is set. Verification is skipped when the key is blank (handy for local dev).
- **Real-time chat** — Socket.IO gateway broadcasts messages, presence updates, room events, and DMs to connected clients.
- **Rooms** — Users can request to join rooms; admins approve membership. The *General* room is joined automatically on first login.
- **Direct messages** — Private, real-time point-to-point messaging between users.
- **Presence** — Users can broadcast an Online / Away / Offline status; all room members receive the update instantly.
- **@mention detection** — The gateway extracts `@username` patterns and emits targeted mention events to the named users.
- **Admin API** — Endpoints to list, approve, and delete users; create, list, and delete rooms; approve or remove room membership.
- **Password management** — Users can change their own password; admins can reset any user's password.
- **SQLite persistence** — Messages, users, rooms, and memberships are stored in a local SQLite file.

## API overview

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | — | Register a new account |
| `POST` | `/auth/token` | — | Login; returns JWT |
| `GET` | `/auth/rooms` | User | List rooms the caller is a member of |
| `POST` | `/auth/rooms/:id/join` | User | Request to join a room |
| `PATCH` | `/auth/password` | User | Change own password |
| `GET` | `/auth/admin/users` | Admin | List all users |
| `PATCH` | `/auth/admin/users/:id/approve` | Admin | Approve a pending user |
| `DELETE` | `/auth/admin/users/:id` | Admin | Delete a user |
| `PATCH` | `/auth/admin/users/:id/password` | Admin | Reset a user's password |
| `GET` | `/auth/admin/rooms` | Admin | List all rooms |
| `POST` | `/auth/admin/rooms` | Admin | Create a room |
| `DELETE` | `/auth/admin/rooms/:id` | Admin | Delete a room |
| `GET` | `/auth/admin/join-requests` | Admin | List pending join requests |
| `PATCH` | `/auth/admin/rooms/:roomId/members/:userId/approve` | Admin | Approve a join request |
| `DELETE` | `/auth/admin/rooms/:roomId/members/:userId` | Admin | Remove a member |

WebSocket events are handled by the Socket.IO gateway at the same host/port.

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | HTTP/WebSocket listen port (default: `8080`) |
| `JWT_SECRET` | Yes | Secret used to sign and verify JWTs |
| `DB_PATH` | No | Path to SQLite file (default: `./chatroom.db`) |
| `ADMIN_USERNAME` | No | Username for the seeded admin account (default: `admin`) |
| `ADMIN_PASSWORD` | No | Password for the seeded admin account (default: `admin123`) |
| `RECAPTCHA_SECRET_KEY` | No | reCAPTCHA v2 secret key; leave blank to disable CAPTCHA verification |
# Mon Jun  8 16:45:21 PST 2026
