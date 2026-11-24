# Language and theme preferences

## Where to work

| Responsibility | Source |
| --- | --- |
| Language/theme controls and account synchronization | [features/preferences/](../../src/features/preferences/) |
| Browser language resolution and theme application | [shared/preferences/](../../src/shared/preferences/) |
| Persistent state and compatibility keys | [app-storage.service.ts](../../src/shared/services/app-storage.service.ts) |
| Messages and i18n setup | [shared/i18n/](../../src/shared/i18n/) |
| Theme palettes and tokens | [shared/themes/](../../src/shared/themes/) |
| Saved account preferences | [users.table.ts](../../server/core/database/tables/users.table.ts), [API routes](../../server/index.ts) |

## Language behavior

Supported locales are English (`en`), Spanish (`es`), French (`fr`) and German (`de`). The first supported entry in `navigator.languages`, then `navigator.language`, wins; matching ignores case and regional suffixes. English is the fallback. The resolved value is cached in `aventyr_global_state.locale` and applied to the document `lang` attribute.

Guests use the local cache. After authentication, a fresh profile language takes precedence; cached Discord user data alone must not start reconciliation. If the account language is unset, matching cached/browser choices save automatically. Otherwise the global choice dialog offers the current and detected language and closes only after a successful save. Failures retain the selection and allow retry.

Manual choices apply immediately and save for signed-in users. Failed saves keep the local choice, show an error notification, and reconcile against the saved profile on the next sign-in. Avoid late requests changing another account's preference.

`users.locale` is nullable: `null` means not chosen. GET `/api/users/:userId/preferences` exposes it; PATCH accepts supported non-null locales. Updating other preferences preserves an unset locale. Schema setup preserves existing languages and starts new Discord profiles unset. Deploy matching client/API versions: older backends normalize null to English and lose the first-visit distinction.

## Themes

Mode (`light`/`dark`) and style (`aventyr`, `arcane`, `campfire`, `explorer`, `kingdom`) are separate preferences. Theme definitions live in shared palettes, and Vuetify registers their combinations. Use semantic theme variables in CSS rather than copying palette values into features.

Without a stored mode, initialization uses the browser's preferred color scheme; the default style is Aventyr. Account synchronization is implemented by `useAppTheme`: an existing local mode takes precedence and can be saved to the account, while a freshly fetched profile supplies preferences when no local mode exists. Do not assume it follows the language reconciliation rules. Current theme-save failures are logged and leave the applied local selection intact.

When adding a style or changing defaults, update the shared type validators, palettes, controls and persistence together. Preserve legacy storage migration and test both light/dark variants. Article sorting is another account preference, owned by [articles](articles.md), rather than this feature's UI.

## Verification

Run `npm run test:frontend`, `npx playwright test tests/browser/preferences tests/browser/home tests/browser/shared/visuals.spec.ts` and `npm run build`. Language schema/persistence changes also require `npm run server:test:locale` with local MySQL. See [testing](../guides/testing.md) for setup.
