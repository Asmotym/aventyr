# Backend refactor evidence — 2026-11-24

Historical snapshot. Use the [backend guide](../guides/backend.md) and [testing guide](../guides/testing.md) for current rules and commands.

## Organization and compatibility

Server behavior now lives in features, application composition in `server/app`, and reusable server infrastructure in `server/infrastructure`. Browser-safe contracts/calculations live in top-level `shared`, grouped by accounts, articles and rooms. Frontend imports use `@shared`; database records remain server-only. An architecture test checks ownership boundaries and runtime dependency cycles.

The entrypoint decreased from 996 to 29 lines and the room dispatcher from 1,106 to 177 lines. Feature routes, room membership/dice/bonus/award operations and ordered schema setup have separate owners. Existing route paths, room actions, response envelopes, socket payloads, storage keys and gameplay rules remain compatible, except for the intentional access fixes below. Operational commands and compiled entrypoint paths remain unchanged.

Image decoding shares a validated normalization policy while retaining feature-specific dimensions, quality, permissions and retention. Connection-based and async-local transactions share lease cleanup without changing lock ordering. Existing transaction-heavy feature operations retain explicit SQL when another abstraction would obscure their transaction boundaries.

Startup no longer happens when importing the HTTP application. Jobs start after successful initialization, prevent overlapping executions, and stop with the server. Shutdown closes HTTP/socket resources, releases the database pool and flushes Sentry.

## Intentional fixes

- Restored decryption with the original Rolz development secret. Configured secrets still take precedence; new keys retain the Aventyr prefix and current encryption format. Regression coverage includes configured-secret precedence and rejection of malformed/incompatible ciphertext.
- Public dice-history reads now require a verified API-key owner who belongs to the room, matching roster access. Missing identity returns 401; an outsider returns 403. OpenAPI documents this behavior.
- Account API-key reads, generation and revocation now verify the requester even for trusted-origin requests. Origin trust is not account authentication. Tests reproduced anonymous access before the fix and verify same-user success and cross-user rejection afterward.

## Cleanup and dependency decisions

Git history identifies `974cbf3` (Room Settings Rework) as the change that rejected legacy bonus-rule writes with a reload conflict. The old create/update/delete handlers and their unused validation helpers/constants were unreachable after that gate and have been removed. The action names still return the same conflict. Legacy tables, migration markers, historical snapshot evaluators and read/spend compatibility remain in use and are retained.

No new libraries were added. `@types/sanitize-html` and its exclusive parser dependencies are now development-only in the manifest/lockfile. Runtime rendering, Markdown conversion, sanitization, highlighting, image processing and socket dependencies still have consumers. An ORM, new HTTP framework, caching layer or alternate test framework would add migration work without a demonstrated benefit.

The runtime Docker image still supports development/watch mode. It retains its existing dependency-copy strategy; this refactor does not claim a smaller container image. Docker copies/mounts the new shared directory.

## Measurements

Compared the original `971c61a` checkout with the refactored production bundle using the same installed toolchain: Node 20.12.2 and MySQL 8 in a disposable local container. Each variant used its own database, 50 rooms with memberships, one fresh-schema startup and three warm startups. Each run made 120 sequential room-list requests; the first 20 warmed the process. Values below are medians of the three warm runs except the fresh-schema row. Timings are indicative local smoke measurements and vary with host load.

| Measurement | Before | After |
| --- | --- | --- |
| Fresh-schema readiness | 7.17 s | 6.85 s |
| Existing-schema readiness | 1.69 s | 1.63 s |
| Room list p50 | 3.16 ms | 3.13 ms |
| Room list p95 | 5.55 ms | 4.67 ms |
| Process RSS after requests | 139.1 MiB | 137.9 MiB |
| Entry JavaScript, unminified | 433,889 bytes | 438,088 bytes |

Performance remains comparable; these results do not establish a production speed improvement. The approximately 1% output increase includes application/test seams and lifecycle cleanup. No chunk thresholds were relaxed, and no speculative query/cache or deployment changes were introduced. Socket correctness is covered by real multi-user integration tests; these timings are not a socket throughput benchmark.

## Validation

- Backend type-check and production build passed; frontend type-check/production build passed.
- Full backend run: 122 tests passed with no skips, including every opt-in MySQL suite, real HTTP/WebSocket checks, configured-secret compatibility and startup/shutdown.
- Combined client/server run: 196 passed, 11 database integrations skipped as expected; those integrations passed in the explicit full-backend run. The subsequently added lifecycle integration also passed in the final full-backend run.
- Tests are grouped by feature/infrastructure, with reusable isolated database and ephemeral HTTP listener fixtures. Focused Bag discovery now includes session-Bag tracking.
- Regression coverage added for HTTP composition, OAuth grants/provider failures, preference validation, API-key ownership/lifecycle, room entry/archive/favorites, dice-history access, role hierarchy, image normalization, transaction cleanup, job overlap/recovery/shutdown and import boundaries.

- Complete browser run: 242 passed with the installed headless Chromium shell and cached system libraries. All screenshot baselines and difference thresholds are unchanged. An initial full-Chromium run produced rendering mismatches; the matching headless shell resolved them.
- Architecture checks, documentation links/commands, OpenAPI examples and whitespace checks passed.

The disposable MySQL container was removed after verification. No production deployment or application-database migration was performed.
