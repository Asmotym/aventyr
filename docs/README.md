# Documentation

Start with [local development](guides/development.md). For a change, read the relevant feature guide and follow the [testing guide](guides/testing.md).

## Development guides

| Guide | Covers |
| --- | --- |
| [Local development](guides/development.md) | Installation, environment variables, local and Docker workflows |
| [Frontend](guides/frontend.md) | Folder ownership, imports, state, components, CSS and everyday rules |
| [SCSS and BEM](guides/styles.md) | Style ownership, class names, reuse and visual verification |
| [UI and notifications](guides/ui.md) | Shared controls, Vuetify defaults, themes and error presentation |
| [Backend and API](guides/backend.md) | Routes, authentication, services, persistence and realtime |
| [Testing](guides/testing.md) | Feature test locations, commands, browser fixtures and MySQL suites |
| [Deployment](guides/deployment.md) | Builds, migrations, backups, proxy configuration and monitoring |

## Feature guides

| Area | Guide |
| --- | --- |
| Home, navigation, administration, legal pages | [Application](features/application.md) |
| Discord login, profiles, settings, API keys | [Accounts](features/accounts.md) |
| Languages and themes | [Preferences](features/preferences.md) |
| Public articles, editor, drafts, categories and images | [Articles](features/articles.md) |
| Room entry, membership, chat and realtime | [Rooms](features/rooms/README.md) |
| Room roles and rights | [Permissions](features/rooms/permissions.md) |
| Dice, categories and critical rules | [Dice](features/rooms/dice.md) |
| Earning and spending bonus points | [Bonus points](features/rooms/bonus-points.md) |
| Sessions, start requests, recaps and owned awards | [Sessions and awards](features/rooms/sessions.md) |
| Team/Personal inventory, templates, gifts and inspection | [Bags](features/rooms/bags.md) |
| Talent editing, progression, access and transfer | [Talents](features/rooms/talents.md) |

The [OpenAPI template](openapi.template.yaml) documents the public read API used by external clients. It stays at this path because both Compose files mount it into Swagger UI. It does not describe every internal application endpoint.

## Maintaining these docs

- Update the owning guide when changing behavior, contracts, setup or file locations. Link to source definitions rather than copying full type declarations.
- Put shared engineering rules in `guides/` and behavior-specific rules in `features/`. Add a guide only when a distinct area needs one, then link it here.
- Use paths relative to the document, keep runnable commands current with `package.json` and `Makefile`, and explain important compatibility or migration constraints beside the feature.
- Keep release measurements and one-time investigations in `history/`. The [frontend refactor report](history/frontend-refactor-2026-11-24.md) and [backend refactor report](history/backend-refactor-2026-11-24.md) and [SCSS/BEM migration report](history/frontend-styles-2026-11-24.md) are historical evidence, not current test or performance baselines.
