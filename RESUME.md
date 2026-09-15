# Connectify — résumé kit

Everything below describes what is actually built and tested in this repository, so any line can go on a résumé, a portfolio page or a LinkedIn post as is.

- Repository: <https://github.com/khushibargali/connectify>
- Stack: React 19, Vite, React Router, Socket.IO, Node.js 22, Express 5, MongoDB 7 / Mongoose 9, JWT, zod, multer, GitHub Actions, Docker

## One-paragraph overview

Connectify is a WhatsApp-style real-time messaging platform. People sign up with a phone number, find each other by number or name, and chat one-to-one or in groups with photos, videos, in-browser voice notes and documents. Messages are delivered instantly over Socket.IO with sent / delivered / read ticks, typing indicators, online presence and last-seen, reactions, quoted replies, edits, in-chat search, unread dividers, mute, group administration and dark mode. The Express API and the React client share one JWT session; a layered service architecture serves both the REST and WebSocket transports, and 43 integration tests run on every push.

## Résumé bullets

### Compact (3 bullets)

- Built **Connectify**, a WhatsApp-style real-time messaging platform (React.js, Node.js/Express.js, MongoDB, Socket.IO) with phone-number sign-up, 1:1 and group chats, photos/videos/voice notes/documents, reactions, replies, edits and search.
- Engineered real-time delivery over Socket.IO/WebSockets with per-user and per-conversation rooms, acknowledgements, optimistic UI with client-side de-duplication, typing indicators, presence and sent/delivered/read receipts.
- Designed the REST API (26 endpoints) and MongoDB schemas with cursor pagination and aggregation-based unread counts; 43 integration tests (REST + sockets) run in GitHub Actions; deployed with Docker Compose, a Render blueprint and a Vercel-hosted client.

### Standard (5 bullets)

- Built a full-stack WhatsApp-style messaging platform with a **React 19** front-end and an **Express 5** REST API: phone-number accounts with E.164 normalisation and JWT authentication, user lookup by number, direct and group conversations, and **26 documented REST endpoints** validated with zod.
- Engineered bidirectional real-time messaging over **Socket.IO/WebSockets**: per-user and per-conversation rooms, acknowledged sends, optimistic UI reconciled by client ids, typing indicators, online presence with last-seen, and WhatsApp-style **sent / delivered / read receipts** driven by per-participant timestamps.
- Implemented a **media pipeline** for photos, videos, in-browser recorded voice notes and documents: MIME-allow-listed multipart uploads (25 MB), upload progress, lightbox viewer, and server-side checks so messages can only attach files the service stored.
- Modelled users, conversations and messages in **MongoDB/Mongoose** with cursor-based pagination, single-aggregation unread counts, reactions, quoted replies, a 15-minute edit window, soft deletes and in-conversation search; added group admin tools, mute and dark mode.
- Hardened and shipped it: helmet, wildcard CORS allow-list, auth rate limiting and membership checks on every operation; **43 integration tests** (REST + Socket.IO on an in-memory MongoDB) in **GitHub Actions**; Docker Compose with MongoDB, a one-click Render blueprint and a Vercel-hosted client.

### Detailed (portfolio page)

- Architected the server as `routes → controllers → services → models`, with the Socket.IO layer reusing the same services and zod schemas as REST so both transports share one set of business rules.
- Implemented JWT authentication for HTTP requests and the WebSocket handshake; accounts are keyed by phone number with usernames generated automatically and login by phone, username or email.
- Built the real-time layer: rooms per user and per conversation, acknowledgement callbacks with error envelopes, presence tracking across multiple devices, typing relays scoped to room members, and delivery/read receipts stored as two timestamps per participant instead of per-message arrays.
- Designed the client state with a reducer-backed context: optimistic messages with client ids replaced on acknowledgement, reconnection re-sync, unread badges, tab-title counts, toasts and desktop notifications.
- Delivered WhatsApp-parity features: photos, videos, voice notes (MediaRecorder), documents, captions, lightbox, emoji reactions, quoted replies with jump-to-original, edits with an "edited" label, in-chat search, an "N unread messages" divider, mute, group rename/photo/add/remove, profile photos and dark mode.
- Secured uploads with a MIME allow-list, random file names, a path-traversal guard, cross-origin resource policy for the separately hosted client, and cleanup of files when messages are deleted.
- Wrote 43 integration tests with Node's test runner, supertest, socket.io-client and mongodb-memory-server, including a regression test for a handler-registration race in the socket connection flow; CI runs tests and the production build on every push.
- Packaged the project for deployment: single-process production mode that serves the built client, Docker Compose with MongoDB and persistent volumes, a Render blueprint, and a Vercel configuration for the client.

## By the numbers

| Metric | Value |
|--------|-------|
| REST endpoints | 26 |
| Socket.IO events | 5 client → server, 12 server → client |
| Integration tests | 43 (auth, conversations, messages, media, features, sockets) |
| React components | 31 |
| Source | ~1,850 lines server, ~6,000 lines client, ~950 lines tests |

## Feature inventory

**Accounts** — phone-number sign-up with country code, auto-generated username, login by phone/username/email, profile photo and "about", find people by name, username or number.

**Conversations** — direct chats de-duplicated per pair, groups with admins, rename, group photo, add/remove members, leave, mute per member, unread counts and badges, last-message previews, search within a chat.

**Messages** — text with emoji picker, photos, videos, voice notes, documents, captions, quoted replies, reactions, edit (15 min), delete for everyone, sent/delivered/read ticks, day and unread dividers, cursor-paginated history.

**Real time** — instant delivery, acknowledgements, typing indicators, online/last seen, live reactions/edits/deletes, group membership updates, reconnection re-sync.

**Notifications** — in-app toasts, tab-title badge, desktop notifications (muted chats respected).

**Platform** — responsive two-pane/one-pane layout, dark mode, production build served by the API, Docker Compose, Render blueprint, Vercel client, CI.

## Interview talking points

- **Why rooms?** Every socket joins `user:<id>` and one room per conversation. Messages are emitted to the conversation room, notifications to user rooms, so fan-out is a single `io.to(room).emit` and membership changes are a `socketsJoin/socketsLeave`.
- **Optimistic UI.** The client inserts a pending message keyed by a client-generated id; the server echoes the id, and a merge step replaces the optimistic row whether the acknowledgement or the broadcast arrives first.
- **Receipts without per-message arrays.** Each participant carries `lastDeliveredAt` and `lastReadAt`; a message is "read" when every other member's timestamp is at or after its `createdAt`. Marking read is one `$max` update, and unread counts are one aggregation with a `$or` clause per conversation.
- **Ordering bug worth telling.** Registering socket handlers after an awaited database call dropped events sent immediately after connect; the fix (register first, then join rooms and emit the ready signal) is covered by a regression test.
- **Upload safety.** Only allow-listed MIME types are accepted, files get UUID names under a month folder, the service verifies attachment URLs resolve inside the upload directory and exist before a message is created, and deleting a message removes the file.
- **Why the API is not on Vercel.** Serverless functions cannot hold WebSocket connections, so the client is on Vercel while the API runs as a persistent Node process (Render/Docker), with wildcard CORS and cross-origin resource policy for media.
- **Testing strategy.** Integration over unit: every suite boots the real Express app and Socket.IO server against an in-memory MongoDB, so tests cover validation, authorisation, persistence and broadcasts together.

## Short blurbs

**LinkedIn / portfolio (2 sentences):** Built Connectify, a WhatsApp-style chat platform with React, Node/Express, MongoDB and Socket.IO: phone-number accounts, media and voice messages, reactions, replies, search, read receipts and presence, all delivered in real time. 43 integration tests run on every push, and the app ships with Docker Compose, a Render blueprint and a Vercel-hosted client.

**One line:** Real-time WhatsApp-style messaging platform — React, Express, MongoDB, Socket.IO — with media, receipts, reactions and CI-tested APIs.
