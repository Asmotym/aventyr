# Frontend SCSS and BEM migration — 2026-11-24

Application-owned styles moved out of Vue components into SCSS under `src/assets/styles/`. Existing scoped/global boundaries, rule order and feature loading remain intact. The maintenance rules are in the [SCSS and BEM guide](../guides/styles.md).

## Changes

- Organize foundations, application shell, shared controls, Vuetify overrides and feature styles separately. Room styles follow their functional areas.
- Use BEM for application classes and state modifiers; update templates, DOM helpers, teleport targets and browser selectors together. Preserve functional IDs and third-party classes.
- Extract static inline presentation and use CSS custom properties for calculated dimensions, positions and progress. Keep documented runtime framework color/presence bindings local.
- Share identical room-settings heroes and rendered article rules through scoped SCSS mixins. Preserve existing theme and overlay behavior.
- Add architecture checks for external SCSS ownership, static style attributes, state naming, stylesheet syntax and application class syntax. Reuse the installed Vue compiler and Sass compiler.
- Add 12 browser tests with 24 reference images covering article editing, profiles, bags and talent viewing/editing at desktop/mobile sizes in light/dark themes. Capture references from the original frontend; existing snapshots remain unchanged.

## Measurements

The production CSS totals below sum all emitted CSS assets, including framework CSS; gzip is calculated separately for each file. They are build measurements, not the initial page's transfer size.

| Metric | Before | After |
| --- | ---: | ---: |
| CSS assets | 20 | 20 |
| CSS bytes | 1,012,752 | 1,055,048 |
| Gzipped CSS bytes | 152,617 | 156,580 |

Longer names and explicit runtime declarations increase total gzipped CSS by 3,963 bytes (about 2.6%). This migration improves ownership and consistency; it does not claim a loading-speed improvement. No dependencies were added. Feature styles still load with their components rather than through a global feature stylesheet.

## Verification

- Frontend tests passed, including SCSS compilation and policy checks alongside the existing feature tests.
- The full Chromium suite ran 254 cases: 248 passed, then the six remaining cases passed after correcting stale test selectors and waiting for a context popup to close before reopening it. All existing and new screenshot comparisons passed.
- Production frontend and server builds passed, verifying type-checking and stylesheet integration. A production browser smoke check confirmed article-editor CSS is absent from the initial home-page requests and loads when entering the editor.
- A one-time comparison against the original source checked that original declaration sets and selector structures remain present after class-name normalization.

The browser environment used the installed Chromium headless shell with its required local OS libraries. Initial article references from the isolated source copy exposed missing icon-font access; those references were recaptured from the original source after fixing that environment. References were not regenerated from the migrated application to hide differences.

These measurements and verification details describe this migration, not an evergreen test-count or performance guarantee. See [testing](../guides/testing.md) for current commands.
