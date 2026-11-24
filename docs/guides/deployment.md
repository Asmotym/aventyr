# Deployment and operations

Read the owning [feature guide](../README.md#feature-guides) for migration or rollback constraints. Keep frontend and API contracts compatible during rollout.

## Build and configuration

```bash
npm run build
npm run server:build
```

The outputs are `dist/` for the frontend and `dist-server/` for the API. `npm run server:start` runs the compiled API. Frontend `VITE_*` URLs and OAuth settings are build-time values; API secrets and database configuration belong in the server environment.

[Production Compose](../../docker-compose.prod.yml) runs separate MySQL, application and Swagger UI services. It uses an external `proxy` network and an internal database network. Configure the external proxy for frontend port 5173, API port 4000 and docs port 6000. Forward WebSocket upgrades for `/ws/rooms/*` to the API and keep idle timeouts above 30 seconds. Set the registered Discord redirect URI to the public frontend URL.

Keep `MYSQL_*`, `DATABASE_URL` and the persistent database volume consistent with the existing installation. Changing service names or deployment directories must not accidentally create an empty database. When migrating an older Rolz installation, stop the old Compose stack with its original file before starting renamed services; provision domains/certificates and any old-domain redirects in the external proxy.

## Release workflow

1. Back up the database and validate schema/data conversions against a restored copy.
2. Run the relevant tests and build checks from [testing](testing.md).
3. Apply `npm run db:update` against the intended database. Startup also runs repeatable schema setup; a failure prevents normal startup. Run additional data conversions only when the feature guide requires them, notably [article conversion](../features/articles.md#migration-and-rollback).
4. Deploy matching client/API versions and verify readiness, login, room entry, realtime reconnect and affected features. Check an existing API key and the Swagger server URL.
5. Retain the backup and inspect correlated errors. A code rollback may also need a coordinated data restore after incompatible writes; additive tables alone usually can remain.

For Compose schema setup, `make db-update SERVICE=aventyr` starts MySQL and runs the updater using the container database host.

| Make command | Effect |
| --- | --- |
| `make prod-up` / `make deploy` | Validate Sentry configuration, build and start production detached |
| `make prod-preflight` | Validate release/source-map upload settings |
| `make prod-logs` | Follow production logs |
| `make prod-down` | Stop production without deleting volumes |
| `make update` | Pull `origin/main`, validate the new release, stop/redeploy production and prune images |

`make update` changes the checkout and causes deployment downtime. `make clean` deletes development Compose volumes; do not use it to stop a database you want to retain. See [Makefile](../../Makefile) for supported overrides; service-specific development targets use `SERVICE=aventyr`.

## Backups and restore

[docker/backup-db.sh](../../docker/backup-db.sh) reads the repository `.env`, dumps the configured database from `aventyr-mysql`, compresses it, and removes matching backups older than 14 days. Overrides are `ENV_FILE`, `MYSQL_CONTAINER` and `BACKUP_DIR` (default `/opt/stacks/backups/aventyr`). Include image tables: inventory and article bytes live in MySQL.

[docker/export-db.sh](../../docker/export-db.sh) and [docker/import-db.sh](../../docker/import-db.sh) are Compose helpers. Import accepts an explicit `.sql`/`.sql.gz` path; set `COMPOSE_FILE=docker-compose.prod.yml` for production. Restore first into an isolated environment and verify content/login/images before considering a production restore. Import executes the dump against its configured target and can overwrite data.

## Monitoring and Sentry

`GET /health` checks API liveness without querying MySQL. `GET /ready` queries MySQL and returns 200 or 503. Use liveness for process health and readiness for dependency-aware traffic routing.

Responses include `X-Request-ID`; JSON errors also include `requestId`. Use that ID to trace logs and reports. Expected 4xx errors remain in logs; 5xx and database availability errors are reported when `SENTRY_DSN` is set. Keep credentials, request bodies and database URLs out of logs and Sentry context; use the existing [observability helpers](../../server/observability/).

`SENTRY_TRACES_SAMPLE_RATE` accepts 0–1, defaulting to 0.1 in production and 1 in development. Health/readiness probes are excluded. Production source-map upload requires `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, a full 40-character Git SHA in `SENTRY_RELEASE`, and an upload token. The Makefile defaults the release to the current commit; `make update` uses the post-pull commit.

Store the upload token in `.secrets/sentry-auth-token` (directory mode 700, file mode 600), set `SENTRY_AUTH_TOKEN_FILE`, or export `SENTRY_AUTH_TOKEN`. Production builds pass it as an ephemeral BuildKit secret, not a runtime secret or build argument. Never commit it. After a configured build, `npm run server:sentry-check` emits a deliberate synthetic event; inspect its event ID, source-mapped frame and scrubbed data.
