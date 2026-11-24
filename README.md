# Aventyr

A tabletop companion with rooms, chat, dice, sessions, inventories, talent trees and articles. The application uses Vue 3, Vite, Vuetify, an Express API, MySQL and room WebSockets.

## Getting started

Use the Node version pinned in [Dockerfile](Dockerfile) (currently Node 26), npm and MySQL 8. Docker Compose can provide the database and development services.

```bash
npm install
cp .env.example .env
```

Fill in database credentials and Discord OAuth settings, then follow [local development](docs/guides/development.md) to start the stack. For an existing configured checkout, `make watch` runs the frontend/backend locally and dependencies in Docker.

## Documentation

The [documentation index](docs/README.md) links to setup, architecture, UI rules, tests, deployment and maintenance guides for every feature.

- [Frontend rules and source map](docs/guides/frontend.md)
- [Backend and API](docs/guides/backend.md)
- [Feature guides](docs/README.md#feature-guides)
- [Testing](docs/guides/testing.md)
- [Deployment and operations](docs/guides/deployment.md)

## Common checks

```bash
npm run test:frontend
npm run test:browser
npm run build
npm run server:typecheck
npm run server:test
```

Browser setup, focused commands and opt-in MySQL integration suites are described in the [testing guide](docs/guides/testing.md).
