# Connectify — Real-Time Messaging Platform

A full-stack chat application: **React.js** front-end, **Express.js** REST API, **MongoDB** persistence and **Socket.IO** for live messaging, typing indicators, presence and notifications.

See [PLAN.md](PLAN.md) for the architecture, data model, API contract and delivery plan.

## Features

- JWT authentication (register, login, session restore)
- Direct and group conversations, member management, admins
- Real-time message delivery with acks and optimistic UI
- Unread counts, read receipts, typing indicators, online presence
- In-app toasts, tab badge and desktop notifications
- Cursor-paginated message history, soft delete
- Responsive two-pane / single-pane layout
- Integration tests for REST and sockets

## Quick start

Requirements: Node.js 20+ and npm. MongoDB is optional for development — when `MONGO_URI` is not set the API starts an in-memory MongoDB (data is lost on restart).

```bash
npm install            # installs root, server and client dependencies
cp server/.env.example server/.env
npm run dev            # API on http://localhost:4000, client on http://localhost:5173
```

Open http://localhost:5173, register two users in two browser windows and start chatting.

### Demo data

Set `SEED_DEMO=true` in `server/.env` (or run `npm run seed` against a real MongoDB). Four users are created — `alice`, `bob`, `carol`, `dave` — all with password `password123`, plus a direct chat and a group.

## Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Runs API and client together |
| `npm run dev:server` / `npm run dev:client` | Run one side |
| `npm test` | Server integration tests (REST + sockets) |
| `npm run build` | Production build of the client into `client/dist` |
| `npm start` | Start the API (serves `client/dist` if present and `NODE_ENV=production`) |
| `npm run seed` | Seed demo data into `MONGO_URI` (`-- --force` to wipe first) |

## Environment

`server/.env`

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 4000 | API port (5000 is used by AirPlay on macOS) |
| MONGO_URI | (in-memory) | MongoDB connection string |
| JWT_SECRET | dev only | Required in production |
| JWT_EXPIRES_IN | 7d | Token lifetime |
| CLIENT_ORIGIN | http://localhost:5173 | Allowed CORS origin(s), comma-separated |
| SEED_DEMO | false | Seed demo users on startup if the DB is empty |

`client/.env` (optional)

| Variable | Default | Description |
|----------|---------|-------------|
| VITE_API_URL | (same origin, proxied by Vite in dev) | API base URL when hosted separately |

## Project structure

```
server/
  src/
    app.js              Express app: middleware, routes, error handling
    index.js            HTTP server + Socket.IO bootstrap
    config/             env, database connection
    models/             User, Conversation, Message (Mongoose)
    routes/             URL → controller wiring + middleware
    controllers/        HTTP adapters (thin)
    services/           Business logic (shared by REST and sockets)
    socket/             Handshake auth, rooms, presence, handlers, emitters
    middleware/         auth, validation, rate limiting, errors, logging
    validation/         zod schemas
  scripts/seed.js       Demo data
  tests/                node:test integration suites
client/
  src/
    api/                axios client + resource modules
    context/            Auth, Socket, Chat providers
    components/         common, sidebar, chat, auth
    pages/              Login, Register, Chat
    lib/                socket factory, formatters
    styles/             global.css
```

## API overview

All routes under `/api`; authenticated routes take `Authorization: Bearer <token>`.

- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`
- `GET /users?q=`, `GET /users/:id`, `PATCH /users/me`
- `GET /conversations`, `POST /conversations/direct`, `POST /conversations/group`, `GET /conversations/:id`
- `POST /conversations/:id/read`, `POST /conversations/:id/members`, `DELETE /conversations/:id/members/me`
- `GET /conversations/:id/messages?before=&limit=`, `POST /conversations/:id/messages`
- `DELETE /messages/:id`

Socket events are documented in [PLAN.md](PLAN.md#7-real-time-protocol-socketio).

## Testing

```bash
npm test
```

Each test file boots its own in-memory MongoDB (the binary is downloaded once and cached).

## Deployment

See [DEPLOY.md](DEPLOY.md) for one-click Render deployment (blueprint included), Docker, and a Vercel front-end setup. In short: build the client, run the API with `NODE_ENV=production`, a real `MONGO_URI`, a strong `JWT_SECRET` and `CLIENT_ORIGIN`; the API serves `client/dist` itself, so one Node process is enough. WebSockets need a persistent host (Render, Railway, Fly.io, Docker), not serverless functions.
