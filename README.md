# Aventyr

Vue 3 + Vite front-end with a standalone Express API that manages rooms, Discord authentication, and MySQL-backed persistence.

## Requirements

- Node.js 18+
- MySQL connection string

## Setup

```bash
npm install
cp .env.example .env
```

Fill in the `.env` file with:

- `DATABASE_URL` – MySQL connection string (PlanetScale, RDS, local Docker, etc.)  
- `DATABASE_SSL` – Set to `true` if the connection requires SSL  
- `BACKEND_PORT` – Port for the API server (default `4000`)  
- `FRONTEND_URL` – Comma-separated origins that should be allowed to call the API  
- `VITE_BACKEND_URL` – Base URL the Vue app uses when talking to the API
- `VITE_REALTIME_URL` – Optional WebSocket base URL override; by default it is derived from `VITE_BACKEND_URL`
- `VITE_PUBLIC_API_BASE_URL` – Public API base URL displayed in Settings → API (dev default: `http://localhost:4000/api`, production: `https://api.aventyr.io/api`)
- `VITE_API_DOCS_URL` – URL opened from Settings → API for the API documentation portal (default dev value: `http://localhost:6060`)
- `VITE_DISCORD_CLIENT_ID` – Discord OAuth application ID embedded in the client
- `VITE_DISCORD_REDIRECT_URI` – OAuth callback URL registered in the Discord developer portal
- `DISCORD_CLIENT_ID` – Discord OAuth application ID used by the API (defaults to `VITE_DISCORD_CLIENT_ID`)
- `DISCORD_CLIENT_SECRET` – Discord OAuth secret used only by the API for code exchange and token refresh
- `DISCORD_REDIRECT_URI` – Server-side copy of the registered callback URL (defaults to `VITE_DISCORD_REDIRECT_URI`)

## Development

- `npm run dev` – Start the Vite dev server.
- `npm run server:dev` – Start the Express API with automatic restarts when server files change (`tsx watch`).

Run both commands in separate terminals for a full-stack dev experience.

## Monitoring

The API exposes unauthenticated root-level probes for monitoring tools:

- `GET /health` – liveness check for the API process. It returns `200` when Express can respond and does not touch the database, so it is safe for frequent probes.
- `GET /ready` – readiness check for the API and MySQL. It runs a lightweight database query, returns `200` when dependencies are available, and returns `503` when the database is unavailable.

Use `/health` for frequent process liveness checks and `/ready` for deployment, load balancer, or dependency-aware readiness checks.

### Sentry diagnostics

Set `SENTRY_DSN` to enable server-side error reporting. Events include a generated request ID, stable operation name, authenticated user ID, safe route/domain identifiers, environment, release, and sampled trace context. Request bodies and credentials are never intentionally attached; authorization, cookies, API keys, passwords, tokens, and database URLs are scrubbed before sending. Expected 4xx errors remain in application logs, while 5xx and database availability failures are sent to Sentry.

`SENTRY_TRACES_SAMPLE_RATE` accepts a number from `0` to `1` and defaults to `0.1` in production or `1.0` in development. Health and readiness probes are never sampled. Every response includes `X-Request-ID`, and JSON error responses also include `requestId`.

Production source-map upload requires `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_RELEASE`, and a Sentry auth token. `make prod-up` derives `SENTRY_RELEASE` from the full Git commit SHA and fails if upload configuration is incomplete. For one-command deployments, put the token in the git-ignored `.secrets/sentry-auth-token` file and restrict it to the deployment user:

```bash
mkdir -p .secrets
chmod 700 .secrets
nano .secrets/sentry-auth-token
chmod 600 .secrets/sentry-auth-token
```

The file must contain only the token. Set `SENTRY_AUTH_TOKEN_FILE` if it lives elsewhere. As an alternative, export `SENTRY_AUTH_TOKEN` from the shell or deployment secret manager. In either case, the token is passed to the Docker build as an ephemeral BuildKit secret; it is not a build argument or runtime container secret. `make update` validates the complete Sentry configuration before stopping production, then uses the post-pull Git SHA for the release.

After a production build, send a deliberate synthetic event with:

```bash
SENTRY_DSN=... SENTRY_RELEASE=... npm run server:sentry-check
```

The command prints the event ID after Sentry acknowledges the event. Confirm that its stack frame resolves to `server/scripts/verify-sentry.ts` and that no secrets or request bodies appear in the event JSON.

## Production Builds

- `npm run build` – Type-check and bundle the Vue client (output in `dist/`).
- `npm run server:build` – Type-check and compile the Express server to `dist-server/`.
- `npm run server:start` – Run the compiled server (`dist-server/index.js`).

Deploy the static assets (e.g. Netlify) and host the Express server anywhere that can expose Node.js + access to the database.

The API host must forward WebSocket upgrades for `/ws/rooms/*` to the same
Express server. Keep the proxy idle timeout above 30 seconds so the server
heartbeat can keep active room connections alive.

## Docker (all-in-one)

To run the frontend, backend, and an embedded MySQL instance inside a single container:

```bash
docker build -t aventyr-all .
docker run --rm -it \
  -p 5173:5173 \
  -p 4000:4000 \
  -p 3306:3306 \
  aventyr-all
```

Environment variables such as `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `BACKEND_PORT`, and `FRONTEND_PORT` can be overridden at `docker run` time. Set `DATABASE_SSL=false` for the bundled MySQL instance; hosted providers should use `true`. Persistent database storage can be mapped by binding `/var/lib/mysql` to a local volume.

### Live reload inside Docker

`docker compose up --build` now gives you a full dev stack without rebuilding the image for every edit. The compose file bind-mounts the source tree and sets `AVENTYR_DEV_MODE=true` so the entrypoint runs `npm run server:dev` and `npm run dev -- --host 0.0.0.0`. Any change under `server/`, `src/`, or the Vite/TypeScript configs is picked up instantly. If you want the previous production-style behavior, set `AVENTYR_DEV_MODE=false`. `ROLZ_DEV_MODE` remains a deprecated fallback for existing automation.

The API documentation portal listens on port `6000` inside the container for reverse-proxy routing, but it is published locally at `http://localhost:6060` by default because browsers block direct navigation to port `6000`. Override `API_DOCS_HOST_PORT` to publish Swagger UI on another local port, and set `VITE_API_DOCS_URL` to the URL the frontend should open from Settings → API. Swagger renders its server URL from `API_DOCS_BASE_URL`; use `http://localhost:4000/api` for local development and omit the variable, or set it to `https://api.aventyr.io/api`, in production.

Existing production installations may keep their current MySQL database/user, Compose volume, and deployment directory by retaining those values in `.env`. `docker/backup-db.sh` now derives the environment file from the repository location and accepts `BACKUP_DIR`, `ENV_FILE`, and `MYSQL_CONTAINER` overrides, so an existing `/opt/stacks/rolz` deployment does not need to move during the rename.

### Aventyr production cutover

Before updating the checkout, stop the running production stack with its current Compose file so the former service and container names do not remain as orphans. Provision DNS, certificates, and reverse-proxy routes for `aventyr.io`, `api.aventyr.io`, and `docs.aventyr.io`; old-domain redirects, if wanted, belong in that external proxy layer. Keep the existing `MYSQL_*` and `DATABASE_URL` values to reuse production data, update the Discord OAuth application and redirect environment variables for `https://aventyr.io`, then deploy the renamed Compose stack.

After deployment, verify `https://api.aventyr.io/health`, `https://api.aventyr.io/ready`, Discord login, room WebSocket upgrades, an existing API key, and that `https://docs.aventyr.io` sends example requests to `https://api.aventyr.io/api`.

### Make targets

The included `Makefile` wraps common Docker commands:

- `make build` – build (or rebuild) the image.
- `make run` – run the stack interactively with logs in the foreground.
- `make up` – run the stack in the background (detached).
- `make stop` – stop the detached container.
- `make logs` – follow container logs.
- `make db-update` – start MySQL if needed, wait for readiness, and run the schema updater inside the app container (uses the Compose MySQL host even if your local `.env` points to localhost).

Variables such as `IMAGE`, `CONTAINER`, or the exposed ports (`FRONTEND_PORT`, `BACKEND_PORT`, `MYSQL_PORT`) can be overridden inline, e.g. `make run BACKEND_PORT=5000`. The Makefile automatically mounts a persistent Docker volume for MySQL data and, if a `.env` file exists, passes it through to the container.
