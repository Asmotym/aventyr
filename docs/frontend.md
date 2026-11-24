# Frontend guide

Start with the feature owning the behavior. Keep changes local until there is a concrete reason to share them.

## Where things belong

| Location | Responsibility |
| --- | --- |
| `src/app/` | Bootstrap, router composition, Pinia/Vuetify plugins, header and footer |
| `src/features/home/` | Guest landing page and authenticated dashboard |
| `src/features/rooms/` | Room state, transport, chat, bags, talents, sessions, dice, awards and room settings |
| `src/features/articles/` | Public browsing/reading, categories, editor and article administration |
| `src/features/admin/` | Administration shell, navigation and user roles |
| `src/features/settings/` | Account settings and personal API keys |
| `src/features/auth/` | Discord authentication and current-user role |
| `src/features/preferences/` | Account synchronization and controls for theme/language preferences |
| `src/features/profiles/` | Public profiles and profile avatars |
| `src/features/legal/` | Terms and privacy pages |
| `src/shared/` | Reusable UI, transport/storage primitives, locale messages, theme definitions and utilities |
| `src/assets/styles/` | Foundations, reusable component styles and feature styles |
| `tests/frontend/<feature>/` | Logic, service and store tests |
| `tests/browser/<feature>/` | Browser workflows and visual regression snapshots |
| `tests/browser/support/` | Browser authentication, API and WebSocket fixtures |

Inside a feature, use `pages`, `components`, `composables`, `services`, `stores`, `utils` and `types` as needed. Do not create empty folders. Rooms further groups its components by behavior. Pages compose features; layouts provide reusable shells.

## Dependencies and state

- Use `@/` for paths rooted at `src`. Prefer a feature's small `index.ts` API when importing its services, stores or composables from another feature. Keep UI imports explicit so an API import does not eagerly load screens.
- Shared code must not import features or application code. Pass callbacks or inject a small interface when generic code needs feature behavior. Avoid feature dependency cycles.
- Route names live in `shared/navigation/routes.ts`; each feature owns its route definitions. Compose them in `app/routes.ts`. Preserve public paths and lazy page imports.
- Home and `/rooms/:roomId` intentionally share the Home page. Preserve the existing room/socket lifecycle when changing this composition.
- Keep HTTP/WebSocket work in services, reusable reactive behavior in composables, and application state in stores. Components own their local UI state.
- Shared API transport receives authentication callbacks from the auth service. It must not import the authentication feature.
- The existing `netlify/*` alias points to `server/*`. Use type-only imports for contracts, and only browser-safe server utilities at runtime. Never import database, filesystem or server initialization code into the client.
- Keep refactoring separate from changing endpoint contracts, storage keys, permissions or product behavior.

## Components and styles

Vuetify configuration and application defaults live in `app/plugins/vuetify.plugin.ts`. Register only components actually used in templates; import Vuetify components from their specific component group. Components imported locally do not need global registration.

| Reusable UI | Use |
| --- | --- |
| `shared/ui/AppDropdown.component.vue` | Single/multiple selection and autocomplete; see [dropdown details](dropdowns.md) |
| `shared/ui/AppColorPicker.component.vue` | Shared color input and validation |
| `shared/ui/AppCloseButton.vue` | Icon-only close action with a translated accessible label |
| `shared/ui/AppDialogHeading.vue` | Standard flex/gradient heading for matching dialog designs |
| `shared/ui/MobileSideButton.component.vue` | Mobile side-panel trigger |

Use Vuetify defaults for repeated visual props. Add a wrapper when repeated markup or interaction warrants one. Forward needed attributes, events, slots and model bindings; preserve keyboard/focus behavior and disabled/loading/validation states. Keep business rules in the feature. Do not wrap every Vuetify component just to rename it.

- `assets/styles/foundations/`: application-wide base rules.
- `assets/styles/components/`: shared controls and Vuetify overrides. Component-owned external styles use `<style scoped lang="scss" src="…">` to preserve their scope.
- `assets/styles/features/<feature>/`: styles shared inside one feature. Import them from that feature so unrelated routes do not load them.
- Keep unique styles scoped in the component. Create utility styles only when multiple callers need the same small layout behavior.
- Use existing Vuetify theme variables. Preserve stylesheet order: foundations, Vuetify base styles, icon font, shared overrides; component styles load with their components.
- Put teleported menu/overlay styling in deliberate global rules. Avoid broad selectors, increasing specificity or adding `!important` to patch unrelated components.
- Extract actual repeated designs. Similar-looking cards with different responsibilities do not automatically need a universal component.

## Everyday practices

- Use typed props, events, service results and injection keys. Avoid new `any` types when the shape is known.
- Keep templates readable. Extract a component or composable when it has a clear responsibility, rather than splitting by an arbitrary line limit.
- Release timers, listeners, subscriptions and object URLs on disposal. Ignore obsolete async responses; preserve editable data when a save fails.
- Reuse `shared/composables/useObjectUrl` for reactive blob images and `shared/utils/clipboard` for text-copy fallback.
- Translate user-facing text through `shared/i18n`. Keep account preference synchronization in its feature.
- Preserve semantic labels, keyboard controls, focus restoration, reduced motion, touch controls and mobile overflow behavior.
- Before deleting code, check templates, dynamic imports, developer-only paths and git history. Do not remove a dependency until checking backend, build and test consumers too.
- Keep dependencies small in number. Prefer existing APIs and utilities; add a library only when it materially simplifies maintained code without losing behavior. Measure bundle and loading effects.

## Verification

```bash
npm run test:frontend          # Recursively discovers frontend tests
npm run test:browser           # All Chromium browser workflows and visual checks
npm run test:rooms:browser     # Room workflows and home room navigation
npm run test:articles:browser  # Reader, editor and article administration
npm run test:talents:browser   # Talent workflows
npm run build                 # Strict application type-check and production bundle
npm run server:test           # Existing server suite, then frontend tests
```

Install the Chromium version matching Playwright with `npx playwright install chromium` and its OS dependencies when setting up a machine. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` supports an existing compatible browser. `PLAYWRIGHT_BASE_URL` targets an already-running frontend instead of starting Vite.

Add tests in the owning feature before changing behavior. Cover success, permissions, invalid input and relevant failure/retry paths; use logic tests for calculations and browser tests for rendered interactions. Prefer role/label selectors. Keep scenario data local, and share fixture setup without calculating expected results using the code under test.

For visual checks, use deterministic data, a consistent browser/OS and reduced motion. Review differences against the original design; do not regenerate snapshots merely to make failures pass. Playwright retains screenshots and traces for failures. See [coverage and refactor evidence](frontend-refactor.md) for this migration's verification and remaining limitations.
