# Language preferences (AVENTYR-47)

The app supports English, Spanish, French, and German. On the first visit it selects the first supported browser language from `navigator.languages`, then `navigator.language`, ignoring case and regional suffixes. It falls back to English. The resolved language is cached in `aventyr_global_state.locale` and applied to the document's `lang` attribute.

Guests use the local cache. After authentication, a fresh profile language takes precedence over that cache. Cached Discord user data is not sufficient to trigger reconciliation. Manual selections apply immediately and update the profile when signed in; failed profile saves show an error, retain the local selection, and reconcile against the saved profile on the next sign-in.

If the profile language is unset, matching cached and detected languages are saved automatically. When they differ, a global dialog offers the current language and detected browser language. The dialog closes after the profile save succeeds and supports retry on failure. Subsequent visits use the saved preference without prompting.

## API and database

`users.locale` is nullable, defaulting to `NULL`. Existing stored languages, including English, are preserved. Discord profile responses and GET/PATCH `/api/users/:userId/preferences` responses expose `locale` as `en | es | fr | de | null`; null means the preference has not been saved. PATCH accepts only supported non-null locale strings. Updates to other preferences preserve an unset locale. New Discord profiles start unset and are resolved by the frontend.

Run `npm run db:update` before deploying the corresponding backend and frontend together. Schema setup also runs on server startup. Older backends normalize unset locales to English; use the matching frontend/backend to retain first-visit prompting behavior.

## Validation

- `npm run server:test` runs locale resolution, synchronization, authentication race, and storage tests alongside the existing suite.
- `npm run server:test:locale` verifies migrations and persistence using a temporary local MySQL database, following the existing integration-test root connection convention.
- `npx playwright test tests/browser/language.spec.ts` verifies choices, retries, manual changes, delayed account loading, and reload persistence.
