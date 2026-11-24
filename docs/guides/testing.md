# Testing

Place regression coverage in the owning feature. Choose the smallest layer that can prove the behavior, and cover important permissions, invalid input, failure/retry and compatibility paths alongside success.

## Locations and commands

| Scope | Location | Command |
| --- | --- | --- |
| Frontend logic, services and stores | [tests/frontend/](../../tests/frontend/) grouped by feature | `npm run test:frontend` |
| Backend tests, including HTTP contracts and architecture checks | [server/tests/](../../server/tests/) grouped by feature/infrastructure | `npm run server:test:backend` |
| Server plus frontend tests | [server/tests/](../../server/tests/) and frontend tests | `npm run server:test` |
| All browser workflows and visual assertions | [tests/browser/](../../tests/browser/) grouped by feature | `npm run test:browser` |
| Rooms and home room entry | `tests/browser/rooms/`, home entry/rooms specs | `npm run test:rooms:browser` |
| Articles | `tests/browser/articles/` | `npm run test:articles:browser` |
| Talents | `tests/browser/rooms/talents*.spec.ts` | `npm run test:talents:browser` |
| Client types and production bundle | [vite.config.ts](../../vite.config.ts), client TypeScript configs | `npm run build` |
| Backend types / compiled bundle | [tsup.config.ts](../../tsup.config.ts) | `npm run server:typecheck` / `npm run server:build` |

`server:test` discovers backend and frontend tests in one run. Database integration tests are skipped unless their opt-in flag is enabled. Do not describe a passing default run as complete database coverage.

Server tests live in `server/tests/features/<feature>/` (including room subfolders) and `server/tests/infrastructure/`. Reuse `server/tests/support/` for temporary databases and HTTP listeners. Keep scenario assertions in the owning feature. Large historical migration scenarios may remain sequential when their setup depends on prior steps.

Frontend and server tests use the Node test runner through [scripts/test-frontend.mjs](../../scripts/test-frontend.mjs). It discovers nested feature tests and applies the repository's TypeScript test configuration. Share reusable setup; do not compute expected results with the function under test.

## Browser setup

```bash
npx playwright install chromium
npm run test:browser
```

Install Chromium's system dependencies if the machine needs them. [playwright.config.ts](../../playwright.config.ts) starts Vite at `http://127.0.0.1:5179`, uses two workers and retains failure screenshots/traces. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selects an existing compatible Chromium. `PLAYWRIGHT_BASE_URL` targets a running frontend and disables automatic Vite startup.

For one area, run for example:

```bash
npx playwright test tests/browser/preferences/language.spec.ts
npx playwright test tests/browser/shared/error-notifications.spec.ts
```

[Browser fixtures](../../tests/browser/support/) mock HTTP and room WebSockets with deterministic data. They do not prove real Discord OAuth, real database transactions or live multi-user delivery. Cover those at the appropriate integration layer and smoke-test a deployed environment when relevant.

Prefer role/label selectors and observable behavior. Test keyboard and touch alternatives, focus restoration, desktop/mobile overflow and both theme modes for changed interactions. For screenshot changes, use a consistent browser/OS and review the rendered difference before accepting a new baseline; do not relax thresholds to hide regressions.

## MySQL integration suites

Use a disposable local MySQL server. These scripts connect as root to `127.0.0.1`, use `MYSQL_PORT` (default 3306) and `MYSQL_ROOT_PASSWORD` (default `root`), and create/drop uniquely named temporary databases. The root account needs database creation/deletion privileges. The fixture never uses the application `DATABASE_URL` as its target. Never run them against production or shared database infrastructure.

| Feature | Command | Opt-in variable |
| --- | --- | --- |
| Runtime lifecycle, room entry and authenticated HTTP access | `npm run server:test:rooms` | `ROOMS_INTEGRATION=1` |
| Locale schema and preferences | `npm run server:test:locale` | `LOCALE_INTEGRATION=1` |
| Bonus configuration migration/evaluation | `npm run server:test:bonus` | `BONUS_INTEGRATION=1` |
| Sessions, awards and room rights | `npm run server:test:awards` | `ROLL_AWARDS_INTEGRATION=1` |
| Inventory, images, transfers and real sockets | `npm run server:test:bag` | `BAG_INTEGRATION=1` |
| Article storage, images and migration | `npm run server:test:articles` | `ARTICLES_INTEGRATION=1` |
| Talent progression, access and concurrency | `npm run server:test:talents` | `TALENT_INTEGRATION=1` |

`npm run server:test:integration` runs all backend tests with every integration flag enabled. Focused scripts set their own flag and select their suite recursively; Bag includes session-Bag recap tracking. Default backend/combined commands keep integrations opt-in. Database credentials may be loaded from `.env`; review the test connection setup before running in an unfamiliar environment.

## Before finishing a change

Run relevant feature tests and the production frontend build for frontend work. Run server tests/type-checks for shared contracts or backend work, and the relevant integration suite for schema, transactional or realtime changes. Exercise a failure/retry path when changing error handling. Report skipped coverage and failures accurately. A historical failure in a report is not proof that a new failure is unrelated.
