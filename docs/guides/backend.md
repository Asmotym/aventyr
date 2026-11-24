# Backend guide

Start with the feature that owns the behavior. Keep routes thin, business decisions in services and reusable infrastructure independent of features.

## Where things belong

| Location | Responsibility |
| --- | --- |
| [server/index.ts](../../server/index.ts) | Environment/Sentry initialization, startup and process signals |
| [server/app/](../../server/app/) | Application factory, feature composition, ordered schema setup, background jobs and shutdown |
| [server/features/auth/](../../server/features/auth/) | Discord, application-role checks and API-key cryptography |
| [server/features/accounts/](../../server/features/accounts/) | Profiles, preferences, personal API keys and user persistence |
| [server/features/admin/](../../server/features/admin/) | User administration |
| [server/features/articles/](../../server/features/articles/) | Public/editor routes, documents, publication, categories, images and migration |
| [server/features/rooms/](../../server/features/rooms/) | Typed action dispatch and membership, chat, dice, bonuses, sessions, awards, bags, talents and room realtime |
| [server/infrastructure/](../../server/infrastructure/) | Database/transactions/schema helpers, HTTP/auth primitives, image decoding, IDs, logging and observability |
| [shared/](../../shared/) | Browser-safe contracts and domain calculations, grouped into accounts/articles/rooms |
| [server/tests/](../../server/tests/) | Feature tests, infrastructure checks and reusable HTTP/database fixtures |
| [server/scripts/](../../server/scripts/) | Explicit operational commands; never import these from request handlers |

Inside a feature, add routes, services, repositories, validation or mapping modules when there is a distinct responsibility. Keep small features small. Existing transaction-heavy Bag, session and talent operations keep closely related SQL beside their transaction logic; extract a repository when it provides a useful persistence boundary, not a pass-through function for every query.

## Imports and contracts

- Application composition may import features and infrastructure. Features may import infrastructure, browser-safe shared code and narrow functions from another feature. Infrastructure must not import features/application code; shared must not import server or frontend code.
- Keep runtime dependencies acyclic. The architecture regression test checks these boundaries. Avoid barrels that eagerly load unrelated implementations.
- Use `@shared/*` in the frontend and relative imports in the server. The old `netlify/*` alias has been removed. Keep database records and Node dependencies out of shared code; use type-only imports for contracts.
- Preserve route paths, methods, action names, response envelopes, status codes and WebSocket payloads when refactoring. Room action contracts live in [rooms.contracts.ts](../../server/features/rooms/rooms.contracts.ts). Browser-facing data types live under `shared/`.
- Add regression coverage before changing behavior. Separate intentional bug fixes from mechanical moves and update affected API/feature docs.

## HTTP and authentication

[createApp](../../server/app/create-app.ts) composes middleware and feature routes without listening, running migrations or starting jobs. Route registration accepts narrow service overrides for HTTP contract tests; production uses the real services. Keep JSON/raw-image parser order and existing size limits.

The [API-key gate](../../server/infrastructure/http/api-key.ts) protects external requests. It accepts `X-API-Key`, Bearer credentials or a legacy query parameter; prefer the header so new clients do not put keys in URLs. Trusted frontend origins bypass this gate. Origin trust alone is not user authentication.

Use [request identity helpers](../../server/infrastructure/http/request-helpers.ts) to verify Discord identity or the API-key owner before same-user operations. This includes reading, generating and revoking account keys. Application roles are separate from [room rights](../../shared/rooms/room-permissions.ts). Check private reads, image access and socket subscriptions as well as writes; hiding a client control does not authorize an operation.

Keep correlated errors in the existing observability helpers. Preserve request IDs and expected 4xx versus dependency/5xx reporting. Do not log credentials, request bodies or database URLs.

## Transactions, schema and events

- Use parameterized queries and existing typed HTTP errors. Preserve validation behavior and stale-revision conflicts.
- `transaction()` shares its current connection through async-local context; `withConnectionTransaction()` provides an explicitly owned connection. Both release leases after commit/rollback. Pass an existing connection to nested operations when the caller owns the transaction; do not acquire another connection while holding its lock.
- Preserve room-lock ordering and the category-tree-before-document lock order. Balances, messages, revisions and recap changes belonging to one operation commit together.
- Publish socket events only after commit. Publication failure must not imply the committed write was rolled back or cause an automatic resend.
- [app/schema.ts](../../server/app/schema.ts) preserves setup order. Feature schema files own additive updates; infrastructure schema modules retain base tables and compatibility migrations. Schema modules must not depend on runtime services.
- Make setup repeatable and preserve historical snapshots, payments and migration markers. Validate fresh setup, legacy backfill and repeated setup against temporary MySQL databases.

Room sockets live in [rooms/realtime](../../server/features/rooms/realtime/). Generic upgrade handling stays in infrastructure. Preserve reauthentication/reconnect, permission revocation and per-user filtering. Talents uses invalidation/refetch; Bag uses scoped snapshots and advisory presence. Do not replace one protocol with the other.

## Jobs, images and dependencies

Background jobs start after successful startup and stop with the server. Keep cleanup intervals and error logging explicit; the same job cannot overlap itself. Shutdown clears jobs, closes sockets/HTTP and the database pool, and flushes Sentry.

Shared image normalization enforces static JPEG/PNG/WebP decoding and size limits. Features retain their own dimensions/quality, authorization, references and cleanup rules. Never make a private image public just to share decoding code.

Check imports, operational scripts and Git history before deleting code. Retain legacy readers/migrations while stored data needs them. Reuse current dependencies; introduce a library only for a concrete simplification. Measure startup, memory, query/response behavior and output size before claiming a performance improvement. Deployment supports development mode in the same image, so removing build/watch dependencies from that image requires a separate packaging change.

## Verification and public API

Follow [testing](testing.md), the owning [feature guide](../README.md#feature-guides) and [deployment](deployment.md). HTTP tests use real route/middleware composition; MySQL and real-socket suites are explicit integration checks.

The [OpenAPI template](../openapi.template.yaml) covers external room, roster and dice-history reads. All require a verified API key; roster and history reads require its owner to be a room member. Internal application endpoints and the room action dispatcher are outside this specification. Preserve the template's `__API_BASE_URL__` placeholder and mounted file path.
