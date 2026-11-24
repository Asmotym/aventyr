# Local development

Run commands from the repository root. Use the Node version in [Dockerfile](../../Dockerfile) (currently 26), npm and MySQL 8. Docker and Compose are needed for the managed development stack.

```bash
npm install
cp .env.example .env
```

## Configure the environment

Use [.env.example](../../.env.example) as the starting point. Its database values are blank: fill them in before starting services.

| Settings | Purpose |
| --- | --- |
| `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `MYSQL_PORT` | Compose database and development helpers; normal local port is 3306 |
| `DATABASE_URL`, `DATABASE_SSL` | API database connection; use `127.0.0.1` for a host process and `mysql` for the Compose application |
| `BACKEND_PORT`, `FRONTEND_URL` | API port (4000) and comma-separated allowed frontend origins |
| `VITE_BACKEND_URL` | Browser API host, normally `http://localhost:4000` |
| `VITE_REALTIME_URL` | Optional WebSocket base override; otherwise derived from the backend URL |
| `VITE_PUBLIC_API_BASE_URL`, `VITE_API_DOCS_URL` | URLs displayed/opened in Settings → API |
| `API_DOCS_BASE_URL`, `API_DOCS_HOST_PORT` | Swagger request base (include `/api`) and published UI port (6060) |
| `VITE_DISCORD_CLIENT_ID`, `VITE_DISCORD_REDIRECT_URI` | Public OAuth application ID and registered callback URL |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` | Server OAuth configuration; secret stays server-side |
| `OWNER_DISCORD_USER_ID` | Application owner identity |

Every `VITE_*` value is exposed to the browser; never put secrets there. Register the exact callback URL with Discord. Restart development processes after environment changes; production frontend values require rebuilding.

## Choose a workflow

**Host application, Docker dependencies:**

```bash
make watch
```

This starts MySQL, Swagger UI and phpMyAdmin, initializes the development database, then starts the API and Vite on the host. It uses a localhost database URL derived from `MYSQL_*`. It terminates an existing listener on the selected frontend port when `lsof` is available. Exiting stops the host processes; use `make down` to stop the Compose services.

**Everything in Compose:**

```bash
docker compose up --build
```

MySQL is a separate service with a persistent volume. The application image contains a database client, not an embedded database server. Development mode mounts source and runs the frontend/API watchers. `AVENTYR_DEV_MODE` controls this; the entrypoint also accepts `NODE_ENV=development` when that switch is unset.

**Existing MySQL without Docker:** configure `DATABASE_URL`, then run these in separate terminals:

```bash
npm run server:dev
npm run dev
```

Schema setup runs at API startup. `npm run db:update` explicitly applies it to `DATABASE_URL`; see [deployment](deployment.md) before using migrations outside development.

## Local addresses and helpers

| Service | Default URL |
| --- | --- |
| Frontend | `http://localhost:5173` |
| API liveness / readiness | `http://localhost:4000/health` / `http://localhost:4000/ready` |
| Swagger UI | `http://localhost:6060` |
| phpMyAdmin (development only) | `http://localhost:8080` |

Swagger uses port 6000 inside its container; use the published 6060 port in the browser. Both Compose files render [the OpenAPI template](../openapi.template.yaml) using `API_DOCS_BASE_URL`.

`make up` and `make run` both start the development stack detached. `make logs SERVICE=aventyr`, `make shell SERVICE=aventyr` and `make stop SERVICE=aventyr` target the application. `make db-update SERVICE=aventyr` runs schema setup with the Compose database host. `make down` retains volumes; `make clean` deletes volumes and database data.

See [testing](testing.md) for browser installation and verification commands.
