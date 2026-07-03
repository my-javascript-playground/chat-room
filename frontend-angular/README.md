# Chatroom Angular

Angular 17 frontend for the chatroom application. Features real-time messaging via Socket.io, direct messages, user sidebar, and an admin panel.

## Tech stack

- Angular 17 (standalone components, lazy-loaded routes)
- Socket.io client
- nginx (production container)

## Project structure

```
src/app/
├── components/
│   ├── chat/                   # Main chat view
│   ├── login/                  # Login page
│   ├── sidebar/                # Online users list
│   ├── message-list/           # Rendered message feed
│   ├── message-input/          # Compose bar
│   ├── direct-message-panel/   # DM thread
│   ├── admin-panel/            # Admin controls
│   ├── change-password-modal/  # Password change dialog
│   └── status-badge/           # User online/offline indicator
├── services/
│   ├── chat.service.ts         # Socket.io connection and events
│   └── session.service.ts      # Auth session state
└── app.routes.ts               # Lazy routes with auth guards
```

## Local development

```bash
npm install
npm start           # http://localhost:3100
```

## Production (Docker)

```bash
docker compose up --build
```

App served by nginx at `http://localhost:8080`.

## Environment

The app connects to the backend WebSocket server. Update the socket URL in `chat.service.ts` to point at your server before building for production.
