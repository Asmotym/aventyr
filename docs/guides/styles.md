# SCSS and BEM

All application styles live in `src/assets/styles/` as SCSS. Components reference external files, preserving Vue's scoped styling and loading styles with the owning feature.

## Where styles belong

| Folder | Contents |
| --- | --- |
| `foundations/` | Global reset, base typography and application defaults |
| `app/` | Application shell, header and footer |
| `components/` | Shared controls such as dropdowns, notifications and dialog headings |
| `overrides/` | Deliberate global Vuetify overrides, including teleported menus |
| `features/<feature>/` | Pages and components owned by that feature |
| `features/rooms/<area>/` | Bags, talents, chat, dice, settings, sessions and awards |

Use the component's kebab-case name for its stylesheet. Keep scoped and global rules in separate files when both are needed (`name.scss` and `name.global.scss`). A feature's shared styles stay inside its feature folder; reusable partials start with `_`.

```vue
<style scoped lang="scss" src="@/assets/styles/features/rooms/bags/bag-item-preview.scss"></style>
```

Preserve `scoped` when moving styles. Use global styles only for explicit cross-component contracts or teleported content. Load them from their owner. Do not import all feature styles from the application entry point: lazy routes should keep their styles lazy. Entry-point order is foundations, Vuetify, icon font, then shared overrides.

## Class names and IDs

Use **BEM**: `block`, `block__element`, `block--modifier` or `block__element--modifier`. Blocks describe a component or a reusable design; elements describe its parts; modifiers describe a state or variant. Keep the base class alongside its modifier.

```vue
<button class="bag-item-card__action" :class="{ 'bag-item-card__action--selected': selected }">
```

```scss
.bag-item-card {
  display: flex;

  &__action {
    padding: 8px;
  }

  &__action--selected {
    color: rgb(var(--v-theme-primary));
  }
}
```

Avoid generic state classes such as `active`, `selected` or `is-open`, and avoid elements of elements (`block__part__child`). Keep nesting shallow; do not mirror the DOM tree. Keep unrelated blocks outside a parent selector, including in comma-separated lists.

Use classes for presentation. IDs serve labels, ARIA relationships, anchors, SVG references and integrations; preserve these contracts. New IDs should be unique, prefixed by their owning block (for example `bag-editor-name-<instance>`), and connected to their consumers. Do not rename functional IDs merely to match a CSS convention.

Vuetify utilities/internal classes, MDI icons, Tiptap/ProseMirror content, syntax-highlighter hooks and Vue's generated transition classes keep their required names. Namespace the application-owned wrapper around them. Use role/label locators in browser tests where possible; update remaining class selectors when renaming a block.

## Reuse and runtime styles

- Use theme variables and semantic custom properties so all theme combinations remain readable. Preserve focus, reduced motion, touch targets and mobile overflow.
- Extract actual duplicated designs. `components/_feature-hero.scss` shares the room-settings hero; `features/articles/_article-content.scss` shares rendered article rules. Use `@use` and include mixins inside the owning scope at the existing cascade position. Avoid shared partials that emit unrelated global CSS as a side effect.
- Keep static declarations in SCSS. For calculated geometry or colors, bind CSS custom properties on the owning element and consume them in its stylesheet. Use meaningful names such as `--room-slide-panel-width`.
- Direct runtime style bindings remain appropriate for framework-controlled color priority and calculated presence styles (bag tab/row/section colors and critical-rule color chips). Keep these exceptions local; do not move static values into JavaScript.
- Keep Vuetify prop defaults in `src/app/plugins/vuetify.plugin.ts`; repeated markup and interaction belong in `src/shared/ui/`. Use `:deep()` narrowly for child/vendor internals. Preserve specificity and rule order during refactors; avoid adding `!important` to resolve unrelated conflicts.

## Verification

`npm run test:frontend` checks external SCSS ownership, missing references, static style attributes, unqualified state classes and SCSS compilation/class syntax. It is a lightweight guard, not a complete BEM linter; review dynamic class expressions and third-party hooks too.

Run `npm run build` and the affected browser workflows. Shared changes require the full browser suite. Compare screenshots using the same browser and OS; check desktop/mobile and light/dark, overlays, keyboard focus and runtime geometry. Capture references before a styling refactor and investigate differences instead of updating snapshots to hide them. See [testing](testing.md) and the [migration report](../history/frontend-styles-2026-11-24.md).
