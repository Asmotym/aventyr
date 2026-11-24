# Frontend work

Read [the frontend guide](../docs/guides/frontend.md) before changing this directory.

Keep feature behavior in its owning feature. Shared code must not import features. Preserve current functionality, routes, storage compatibility, themes and accessibility during refactors. Add regression coverage before behavior changes, and verify relevant tests plus the production build. Check references and git history before deleting code.

Follow [SCSS and BEM rules](../docs/guides/styles.md). Put authored styles in external SCSS under `assets/styles/`, preserve scoped/global behavior and lazy loading, and use BEM for application classes. Preserve functional IDs and vendor/editor hooks; use CSS variables for calculated styles.
