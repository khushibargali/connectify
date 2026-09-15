# Deploying Connectify

**Current demo link (2026-09-15):** full app through a Cloudflare tunnel at <https://latitude-voip-cartoons-nowhere.trycloudflare.com>, source at <https://github.com/khushibargali/connectify>. The tunnel is temporary; to make the API permanent follow Option A below.

Connectify is two deployable pieces: the **API** (Express + Socket.IO, needs a long-running Node process because of WebSockets) and the **client** (static Vite build). The API can also serve the built client itself, so the simplest production setup is a single Node service.

> Vercel serverless functions do not support WebSockets, so the API must run on a host with persistent processes (Render, Railway, Fly.io, a VPS, Docker). The client can live on Vercel or be served by the API.

## Option A — Render (one click, free tier)

The repo contains a [render.yaml](render.yaml) blueprint that builds the client, starts the API, and serves both from one URL.

1. Open <https://render.com/deploy?repo=https://github.com/khushibargali/connectify> (or Dashboard → New → Blueprint → pick the repo).
2. Accept the defaults and click **Apply**. A `JWT_SECRET` is generated for you.
3. Wait for the build (3–5 minutes on the first deploy). Your app is at `https://connectify-<hash>.onrender.com`.

Out of the box it runs in **demo mode**: an in-memory MongoDB is seeded on every start (users `alice`, `bob`, `carol`, `dave`, password `password123`). Data and uploaded media reset whenever the service restarts, which on the free tier happens after 15 minutes of inactivity. For durable uploads attach a Render disk (or any host with persistent storage) and point `UPLOAD_DIR` at it.

**Persistent data:** create a free MongoDB Atlas cluster (<https://www.mongodb.com/atlas>, M0 tier), allow access from anywhere (`0.0.0.0/0`) and add the connection string as `MONGO_URI` in the Render service's Environment tab. Set `SEED_DEMO=false` if you don't want demo users.

## Option B — Docker (Railway, Fly.io, any VPS)

```bash
docker build -t connectify .
docker run -p 4000:4000 \
  -e MONGO_URI='mongodb+srv://...' \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e CLIENT_ORIGIN='https://your-domain.com' \
  connectify
```

The image expects `MONGO_URI` (the in-memory fallback is a dev dependency and is not included). Railway and Fly.io both detect the Dockerfile automatically.

## Option B½ — Docker Compose (MongoDB included)

```bash
export JWT_SECRET=$(openssl rand -hex 32)
docker compose up --build
```

Starts MongoDB 7 and the app on <http://localhost:4000> with persistent volumes for data and uploads.

## Option C — Client on Vercel, API elsewhere

1. Deploy the API with Option A or B and note its URL, e.g. `https://connectify.onrender.com`.
2. On Vercel, import the repo with **Root Directory** = `client` (framework: Vite) and set the environment variable `VITE_API_URL=https://connectify.onrender.com`.
3. On the API, set `CLIENT_ORIGIN` to include your Vercel domain (wildcards allowed, e.g. `https://*.vercel.app,https://connectify.vercel.app`).

[client/vercel.json](client/vercel.json) builds with `--mode vercel` (so `client/.env.vercel` supplies `VITE_API_URL` without affecting local builds) and contains the SPA rewrite so deep links such as `/c/<id>` work.

## Temporary public link from your own machine

For a quick demo without any hosting account you can expose the local production build through a Cloudflare quick tunnel (no sign-up):

```bash
npm run build                 # build the client once
npm run start:prod            # API + client on http://localhost:4000 (reads server/.env)
npm run tunnel                # prints a https://<random>.trycloudflare.com URL
```

The link works as long as both processes keep running; the URL changes each time the tunnel restarts.

## Environment variables (API)

| Variable | Required in prod | Notes |
|----------|------------------|-------|
| `JWT_SECRET` | yes | long random string; the server refuses to start with the dev default |
| `MONGO_URI` | recommended | omit for demo mode (in-memory, dev dependency) |
| `CLIENT_ORIGIN` | yes if the client is on another domain | comma-separated, `*` wildcards allowed |
| `PORT` | no | defaults to 4000 |
| `SEED_DEMO` | no | `true` seeds demo users when the database is empty |
