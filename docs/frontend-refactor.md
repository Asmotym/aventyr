# Frontend refactor evidence

## Organization and compatibility

Frontend behavior now lives in features, with application setup in `src/app` and reusable infrastructure/UI in `src/shared`. Room components are grouped into chat, bags, talents, sessions, settings, dice and awards. Article reading and administration share the articles feature. See [the frontend guide](frontend.md) for placement rules.

Routes retain their paths, names and guards. Storage keys, account preferences, API/WebSocket contracts, permissions, themes, translations and developer tools remain compatible. Backend implementation files were not modified.

Room settings now composes separate critical-rule, bonus-point and roll-award managers. Shared UI consolidates dropdowns, color inputs, close actions and matching dialog headings. Shared utilities own object-URL disposal, clipboard fallback, hex parsing and luminance calculation. Profile avatars receive room integration through an injected interface rather than importing the room store. Shared HTTP transport receives authentication callbacks, and locale infrastructure is separated from account synchronization.

One accessibility correction was made: room panels now explicitly default `modal` to `true`. Vue otherwise casts the omitted optional Boolean prop to `false`, bypassing the existing focus-trap code. Talent context panels retain their explicit `modal=false` so the canvas stays usable.

## Coverage

The original 15 frontend test files and 213 browser scenarios are retained and reorganized. Added coverage brings the frontend to 83 logic/service/store tests in 19 files and the browser suite to 239 scenarios in 32 files.

| Feature | Covered behavior |
| --- | --- |
| Home | Guest and restored-account rendering, navigation, dashboard, mobile room selection, favorites, all five theme styles |
| Authentication | Existing OAuth/refresh/expiry logic and route guards; added browser logout and persisted credential clearing |
| Room entry | Added create/join validation, normalized payloads, failure retention, retries and navigation on desktop/mobile |
| Chat and room tools | Message rendering, dice suggestions, critical effects, overlay geometry, keyboard focus, preserved drafts and developer tools |
| Room settings | Permissions, discard confirmation, dice/categories, critical editing, awards, bonus conditions/effects and failed mutations |
| Bags | Inspection, permissions, gifts, templates, item fields, icon selection, realtime updates and stale state |
| Sessions | Activity queues, session-start coordination, award attribution, recap/history navigation, bag activity and failures |
| Talents | Editing layouts, canvas gestures, connectors, appearance, progression, conditions, access, import/export and archives |
| Articles | Reading, filters, pagination, sorting, translated category URLs, editor actions, autosave, uploads, tables, colors, text import and publication |
| Administration | Nested routes, role guards, navigation, user roles and article actions |
| Account settings | Added profile-save failure/retry/persistence and API key generation, visibility, regeneration, cancellation and revocation |
| Preferences/legal | Existing locale reconciliation and persistence; added theme restoration and mobile legal-page checks |
| Shared utilities/UI | Existing dropdown and notification tests; added dice parsing/roll semantics, clipboard fallback, image request races/disposal and color calculations |

Twelve screenshot assertions cover guest Home, account settings and room settings in light/dark themes on desktop/mobile. Reference images were captured against the original frontend. Guest snapshots wait for the mocked news request to finish. Existing feature screenshots and interaction assertions remain.

Several original browser tests had stale assumptions. Fixtures now include the dice type required for active critical rules; assertions use current session labels and the 20-message display window. Mobile tests inspect the visible navigation and dialog content, allow one CSS pixel for scroll geometry, and verify focus wrapping using actual focusable controls. These changes preserve the original workflow assertions.

## Cleanup and dependency decisions

| Removed item | Reference/history evidence |
| --- | --- |
| Frontend Markdown highlighter | Added in `d6b3364`; its editor consumer was removed in `efcb8e0` when the block editor replaced the old Markdown UI. No current frontend imports remain. Server highlighting stays in use. |
| Obsolete room-settings scoped CSS | Tab components were extracted in `61bf875`. The parent retained rules for markup now owned by the tabs. These non-deep scoped selectors no longer matched parent markup. Active layout/deep rules and tab styles remain. |
| Vendor stylesheet forwarding layer | It only imported the application base stylesheet. The same base rules now load directly from `assets/styles/foundations/base.scss`. |
| `cors` and `@types/cors` | Server code uses its own middleware. History shows the package middleware replaced in `67115c2`/`ad96ac6` and the remaining type import removed in `3c172be`. No package consumers remain; manifest and lockfile were updated offline. |

No new libraries were introduced. Existing editor, highlighting, Markdown, sanitization, image-processing and backend dependencies have current consumers. Replacing them would add compatibility work without a demonstrated simplification. The complete icon catalog and font remain available; generated fallback font files are build assets, not four fonts downloaded by every browser.

## Production bundle measurements

Same installed toolchain, default Vite production build; decimal KB. These are emitted asset sizes, not measured user load times.

| Asset | Before raw / gzip | After raw / gzip |
| --- | --- | --- |
| Entry JavaScript | 939.56 / 306.84 KB | 749.01 / 251.69 KB |
| Home page JavaScript | 620.17 / 149.16 KB | 22.17 / 7.43 KB |
| Entry CSS | 802.82 / 113.58 KB | 728.38 / 102.53 KB |
| Room chat JavaScript | Included in Home | About 447 / 116 KB, loaded when entering a room |
| Icon picker JavaScript | Included in Home/room graph | 174.18 / 32.86 KB, loaded when the picker mounts |
| Article editor JavaScript | 527.08 / 164.36 KB | About 527 / 164 KB, retained on editor routes |

Explicit Vuetify component-group imports and registration replace blanket registration; Vuetify base styles replace the full prebuilt stylesheet. Home defers room chat, and icon pickers defer the complete icon catalog. No chunk-warning threshold was increased. The editor still warrants Vite's large-chunk warning because its existing editing capabilities remain intact.

Production request inspection confirmed that guest Home requests neither the chat nor icon-picker chunk. Entering a room loads chat while the icon picker remains deferred. Both flows requested only the WOFF2 icon font and produced no page errors.

## Validation and limits

| Check | Result |
| --- | --- |
| Production build and application type-check | Passed |
| Backend type-check | Passed |
| Frontend tests | 83 passed across 19 files |
| Complete Chromium browser suite | 239 passed across 32 files |
| Production workflow and visual smoke checks | 22 passed |
| Repeated desktop/mobile scroll-layout checks | 10 passed |
| Combined backend/frontend test command | 173 passed, 1 existing backend failure, 10 skipped database integration tests |
| Source reference/dependency inspection | No unexpected unreferenced source files; no shared imports from features/application code |

Browser validation used the installed Chromium through the existing executable override, with locally cached runtime libraries. Screenshots were compared without increasing difference thresholds. The default browser worker count is two; the complete final verification used four workers.

Database-dependent integration suites require their existing opt-in flags and a configured test database; browser tests use deterministic API/WebSocket fixtures. Real Discord authorization and live multi-user/database behavior are not exercised by those browser fixtures.

The existing server branding test currently fails to decrypt a key encrypted with the legacy development secret: `LEGACY_DEFAULT_SECRET` equals the new secret in the unchanged backend implementation. This failure was reproduced separately from the frontend changes. It is left for a backend fix rather than changing encryption behavior during this refactor.
