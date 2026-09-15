# Connectify — Project Plan

Real-time messaging platform built with **React.js, Node.js, Express.js, MongoDB and Socket.IO**.

This document is the working plan for the project: what is being built, how it is structured, the API and real-time contracts, and the delivery phases. Every phase below is implemented in this repository; the checkboxes record what shipped.

---

## 1. Goals

| Goal | How it is met |
|------|---------------|
| Full-stack chat app with auth, persistence and live delivery | React SPA + Express REST API + MongoDB + Socket.IO |
| REST endpoints for user and conversation management | `/api/auth`, `/api/users`, `/api/conversations`, `/api/messages` |
| Bidirectional real-time messaging and notifications, no polling | Socket.IO over WebSockets with rooms per user and per conversation |
| Clean separation of transport, business logic and data access | `routes → controllers → services → models`, sockets in their own layer that reuse the same services |
| Confidence it works | Integration tests for REST and sockets running against an in-memory MongoDB |

## 2. Scope (MVP)

- [x] Register / login / logout with JWT (bcrypt-hashed passwords)
- [x] User search and profile editing (display name, bio, avatar URL)
- [x] Direct (1:1) conversations, de-duplicated per user pair
- [x] Group conversations with admins, add members, leave
- [x] Message history with cursor pagination
- [x] Live message delivery, optimistic sending, delivery acks
- [x] Unread counts and read receipts ("Seen")
- [x] Typing indicators
- [x] Online / offline presence with last-seen
- [x] In-app toasts, tab-title badge and desktop notifications
- [x] Soft delete of own messages
- [x] Responsive layout (desktop two-pane, mobile single-pane)
- [x] Demo seed data
- [x] Automated tests (auth, conversations, messages, sockets)

Out of scope for v1 (see roadmap): media uploads, message reactions, end-to-end encryption, push notifications, horizontal scaling of Socket.IO.

## 3. Architecture

```
┌──────────────────────────┐        HTTPS / REST (JSON)        ┌──────────────────────────────┐
│  React SPA (Vite)        │ ────────────────────────────────▶ │  Express API                 │
│  • AuthContext (JWT)     │                                   │  routes → controllers →      │
│  • SocketContext         │ ◀──── WebSocket (Socket.IO) ────▶ │  services → models (Mongoose)│
│  • ChatContext (reducer) │        events + acks              │  socket/ (auth, rooms,       │
└──────────────────────────┘                                   │  presence, handlers)         │
                                                               └──────────────┬───────────────┘
                                                                              │
                                                                              ▼
                                                               ┌──────────────────────────────┐
                                                               │  MongoDB                     │
                                                               │  users · conversations ·     │
                                                               │  messages                    │
                                                               └──────────────────────────────┘
```

**Request path (REST):** `routes/*.routes.js` declare URLs and attach middleware (auth, validation) → `controllers/*` translate HTTP into service calls → `services/*` hold all business rules and talk to `models/*`. Controllers that change shared state call `socket/emitters.js` so connected clients are updated in real time.

**Real-time path:** `socket/index.js` authenticates the handshake with the same JWT, joins the socket to `user:<id>` and `conversation:<id>` rooms, and registers handlers. Handlers validate payloads with the same zod schemas and call the same services as REST, then broadcast through the emitters. Nothing is duplicated between the two transports except the thin adapter layer.

## 4. Tech stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Front-end | React 19, React Router 7, Vite | Fast dev loop, modern hooks/context, no heavy state library needed |
| HTTP client | axios | Interceptors for auth header and error normalisation |
| Real-time | socket.io / socket.io-client 4 | Rooms, acks, auto-reconnect, WebSocket with fallback |
| API | Node 20+, Express 5 | Async error propagation built-in, mature ecosystem |
| Database | MongoDB + Mongoose 9 | Flexible message documents, indexes for conversation/message queries |
| Auth | JSON Web Tokens + bcryptjs | Stateless, works for both HTTP and socket handshakes |
| Validation | zod | One schema set shared by REST and socket handlers |
| Security | helmet, cors, express-rate-limit | Sensible headers, origin allow-list, brute-force protection on auth |
| Tests | node:test, supertest, socket.io-client, mongodb-memory-server | Zero extra test runner; real DB semantics without a local install |

## 5. Data model

### User
| Field | Type | Notes |
|-------|------|-------|
| username | string, unique, lowercase | 3–30 chars, `[a-z0-9_]` |
| email | string, unique, lowercase | |
| passwordHash | string | never selected by default |
| displayName | string | |
| avatarUrl, bio | string | optional |
| lastSeenAt | date | updated when the last socket disconnects |

### Conversation
| Field | Type | Notes |
|-------|------|-------|
| type | `direct` \| `group` | |
| name | string | groups only |
| participants | `[{ user, lastReadAt, joinedAt }]` | `lastReadAt` powers unread counts and read receipts |
| admins | `[userId]` | groups only |
| directKey | string, unique sparse | `"<idA>:<idB>"` sorted, prevents duplicate 1:1 chats |
| lastMessage, lastMessageAt | ref, date | for the conversation list |

Index: `{ 'participants.user': 1, lastMessageAt: -1 }`.

### Message
| Field | Type | Notes |
|-------|------|-------|
| conversation | ref | |
| sender | ref | |
| type | `text` \| `system` | system = "created the group", "added X", "left the group" |
| content | string ≤ 4000 | emptied on soft delete |
| clientId | string | optimistic-UI reconciliation |
| deletedAt | date \| null | soft delete |

Index: `{ conversation: 1, _id: -1 }` (cursor pagination by `_id`, which is time-ordered).

**Unread count** = messages in the conversation with `createdAt > my.lastReadAt` and `sender ≠ me`, computed in one aggregation for all conversations in the list.

## 6. REST API

All routes are prefixed with `/api`. Authenticated routes expect `Authorization: Bearer <token>`. Errors are `{ error: { message, details? } }`.

| Method | Path | Auth | Body / Query | Result |
|--------|------|------|--------------|--------|
| POST | /auth/register | – | username, email, password, displayName? | 201 `{ user, token }` |
| POST | /auth/login | – | identifier (username or email), password | `{ user, token }` |
| GET | /auth/me | ✓ | | `{ user }` |
| POST | /auth/logout | ✓ | | `{ ok }` |
| GET | /users?q=&limit= | ✓ | | `{ users }` (excludes self) |
| GET | /users/:id | ✓ | | `{ user }` |
| PATCH | /users/me | ✓ | displayName?, bio?, avatarUrl? | `{ user }` |
| GET | /conversations | ✓ | | `{ conversations }` sorted by activity, with `unreadCount` |
| POST | /conversations/direct | ✓ | userId | 201/200 `{ conversation }` (idempotent) |
| POST | /conversations/group | ✓ | name, memberIds[] | 201 `{ conversation }` |
| GET | /conversations/:id | ✓ | | `{ conversation }` |
| POST | /conversations/:id/read | ✓ | | `{ readAt }` |
| POST | /conversations/:id/members | ✓ admin | memberIds[] | `{ conversation }` |
| DELETE | /conversations/:id/members/me | ✓ | | `{ ok }` (leave group) |
| GET | /conversations/:id/messages?before=&limit= | ✓ | | `{ messages, hasMore, nextCursor }` |
| POST | /conversations/:id/messages | ✓ | content, clientId? | 201 `{ message }` |
| DELETE | /messages/:id | ✓ owner | | `{ message }` |
| GET | /health | – | | `{ status }` |

## 7. Real-time protocol (Socket.IO)

Handshake: `io(url, { auth: { token } })`. Invalid or missing tokens are rejected at the middleware.

Rooms: `user:<userId>` (every socket of a user) and `conversation:<conversationId>` (every participant's sockets). Sockets join their conversation rooms on connect; the server adds/removes sockets when membership changes.

**Client → server**

| Event | Payload | Ack |
|-------|---------|-----|
| message:send | `{ conversationId, content, clientId? }` | `{ ok, message }` or `{ ok:false, error }` |
| conversation:read | `{ conversationId }` | `{ ok, readAt }` |
| typing:start / typing:stop | `{ conversationId }` | – |

**Server → client**

| Event | Payload | Sent to |
|-------|---------|---------|
| message:new | message | conversation room |
| message:deleted | `{ conversationId, messageId }` | conversation room |
| notification | `{ type:'message', conversationId, message }` / `{ type:'conversation:added', conversation }` | user rooms of every participant except the actor |
| conversation:new | conversation | user rooms of participants |
| conversation:updated | conversation | participants |
| conversation:removed | `{ conversationId }` | the user who left |
| conversation:read | `{ conversationId, userId, readAt }` | conversation room |
| typing | `{ conversationId, userId, isTyping }` | conversation room except sender |
| presence:list | `[userId]` | the connecting socket |
| presence:update | `{ userId, online, lastSeenAt? }` | everyone |

## 8. Client architecture

```
src/
  api/        axios instance + one module per resource
  lib/        socket factory, formatting helpers, conversation helpers
  context/    AuthContext (session), SocketContext (connection), ChatContext (reducer: conversations, messages, typing, presence, toasts)
  components/ common (Avatar, Button, Modal…), sidebar (list, new chat), chat (window, list, bubble, input)
  pages/      Login, Register, Chat
```

Key behaviours:
- **Optimistic send:** a pending bubble is added immediately with a `clientId`; the ack (or the `message:new` broadcast) replaces it. Failures are marked and can be retried by resending.
- **Read tracking:** opening a conversation, or receiving a message while it is open and the tab is visible, emits `conversation:read`. Other participants' `lastReadAt` drives the "Seen" indicator.
- **Reconnect:** on Socket.IO reconnect the client reloads the conversation list and re-fetches message pages, so nothing missed during the outage is lost.
- **Notifications:** toasts for messages in other conversations, `(n) Connectify` tab title, and optional desktop notifications when the tab is hidden.

## 9. Security

- Passwords hashed with bcrypt; hashes never serialised.
- JWT verified on every REST request and every socket handshake; tokens expire (default 7 days).
- Membership checks in the service layer for every conversation/message operation (no IDOR).
- Zod validation for all bodies, query strings and socket payloads; ObjectId params validated before hitting the DB.
- Helmet security headers, CORS allow-list, JSON body limit, rate limiting on auth endpoints.
- Production refuses to start with the default JWT secret.

## 10. Testing

`npm test` runs `node --test` in `server/`, spinning up an in-memory MongoDB per test file:

- `auth.test.js` — register/login/me, validation, duplicates, bad credentials
- `conversations.test.js` — direct idempotency, groups, membership rules, unread counts, read marks
- `messages.test.js` — send/list/paginate/delete, authorisation
- `socket.test.js` — handshake auth, live delivery + notification, acks, typing relay, read broadcast, presence

## 11. Delivery phases

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 0 | Repo layout, scripts, env handling, plan | ✅ |
| 1 | Data models + DB connection (with in-memory fallback for dev) | ✅ |
| 2 | Auth: register/login/me, JWT middleware, validation, error handling | ✅ |
| 3 | Users, conversations, messages REST + services | ✅ |
| 4 | Socket.IO layer: auth, rooms, messaging, typing, read, presence, notifications | ✅ |
| 5 | React client: auth pages, chat layout, contexts, optimistic UI | ✅ |
| 6 | Polish: responsive UI, toasts, desktop notifications, groups UI, profile | ✅ |
| 7 | Tests, seed data, documentation | ✅ |

## 12. Roadmap (post-v1)

1. File and image messages (S3-compatible storage, signed URLs)
2. Message reactions and replies/threads
3. Redis adapter for Socket.IO to scale across instances; Redis-backed presence
4. Refresh tokens + httpOnly cookies
5. Web push notifications via service worker
6. Full-text message search (Atlas Search / text index)
7. Docker Compose for one-command local setup and CI pipeline

## 13. Verification log

**2026-09-15 — v1 complete.**

- `npm test`: 27 integration tests pass (auth, conversations, messages, sockets) against an in-memory MongoDB.
- `npm run build`: production client bundle builds (Vite 8, ~127 kB gzipped).
- Manual QA in a headless browser against the seeded API: login → conversation list → open group chat (unread badge clears) → send → second user typing indicator in header and composer → live reply → "Seen by 1" → sidebar preview updates; group details modal; user search → new direct chat → send → delete (tombstone in list and sidebar); logout; registration field errors and successful sign-up; session restore on reload; mobile layout (single pane, back button, no horizontal overflow). No console errors.
- Note: on macOS port 5000 is taken by AirPlay Receiver, so the API defaults to port 4000.
- Deployed 2026-09-15: source pushed to a private GitHub repo; client deployed to Vercel (git-linked, auto-deploys on push); API + client also served through a Cloudflare tunnel from the dev machine and verified in a browser (login, WebSocket upgrade, live send, deep-link reload). Render blueprint and Dockerfile added for permanent hosting.
