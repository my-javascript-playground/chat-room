# CLAUDE.md — Chatroom Angular

## Commands

```bash
npm start                          # dev server on :3100
npx ng serve --port 4200           # dev server on alternate port
npm run build -- --configuration production  # production build → dist/chatroom-angular/browser/
npx tsc --noEmit                   # type-check without emitting
docker compose up --build          # build and run nginx container on :8080
```

## Architecture

Standalone Angular 17 components throughout — no NgModules. Routes are lazy-loaded via `loadComponent`. Two route guards (authGuard, loginGuard) live in `app.routes.ts` and use `SessionService` to protect `/` and redirect away from `/login` when already authenticated.

Real-time communication is handled by `ChatService` which wraps the Socket.io client. All socket events (messages, user list, DMs) flow through this service.

## Key conventions

- Components use `@Input()` with `!` (definite assignment assertion) for required inputs bound by parents.
- Services are `providedIn: 'root'` singletons.
- No NgRx — session and chat state live in services with RxJS subjects/observables.

## Docker

Multi-stage Dockerfile: Node 20 Alpine builds, nginx 1.27 Alpine serves.
The Angular 17 `application` builder outputs to `dist/chatroom-angular/browser/` (note the `/browser/` subfolder — older builders did not have this).
`nginx.conf` uses `try_files $uri $uri/ /index.html` to support client-side routing on refresh.
