# Home, navigation, administration and legal pages

## Where to work

| Area | Source | Browser coverage |
| --- | --- | --- |
| Bootstrap and global composition | [main.ts](../../src/main.ts), [App.vue](../../src/App.vue) | [home](../../tests/browser/home/), [shared](../../tests/browser/shared/) |
| Header, footer, router and plugins | [app/](../../src/app/) | Home navigation and auth guards |
| Guest landing and signed-in dashboard | [features/home/](../../src/features/home/) | [home](../../tests/browser/home/) |
| Admin layout, navigation and user roles | [features/admin/](../../src/features/admin/), [admin service](../../server/features/admin/admin.service.ts) | [admin](../../tests/browser/admin/) |
| Terms and privacy | [features/legal/](../../src/features/legal/) | [legal](../../tests/browser/legal/) |
| Translated copy | [shared/i18n/locales/](../../src/shared/i18n/locales/) | Owning workflow specs |

## Home and routing

Home owns guest/account composition, news and room entry. Room components and state stay in the [rooms feature](rooms/README.md); article/news behavior stays in [articles](articles.md). Home and `/rooms/:roomId` share the Home page deliberately. Changing that composition must preserve room selection, subscriptions and cleanup.

Add route records to the owning feature and compose them in [app/routes.ts](../../src/app/routes.ts). Route-name constants live in [shared/navigation/routes.ts](../../src/shared/navigation/routes.ts); auth/admin/owner guards live in [app/router.ts](../../src/app/router.ts). Keep screens lazy-loaded. Preserve public URLs and link generation when moving files.

## Administration

The admin feature provides the shell and user-role management; article administration belongs to articles even though its routes are nested under the admin layout. Application roles are `user`, `admin` and `owner`. Only the owner can change another lower-ranked user's role; owner assignment is not available through that operation. Server checks in [roles.service.ts](../../server/features/auth/roles.service.ts) remain authoritative.

When adding navigation, use the same permission rules for the link, route and endpoint. Test direct navigation as well as clicking a visible link. Application admin rights do not grant room-specific rights.

## Legal content and shell changes

Legal pages share `LegalPage.component.vue`. Keep translated content in locale messages and the shared layout in that component. Review policy text for accuracy when behavior changes; do not silently alter policy meaning during a style refactor.

Verify guest/restored-account states, logout, mobile navigation, keyboard focus, footer/legal links and light/dark rendering when changing the shell. Run the relevant browser folders with `npx playwright test tests/browser/home tests/browser/admin tests/browser/legal`, then `npm run build`. See [testing](../guides/testing.md) for fixture limitations.
