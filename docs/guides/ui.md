# Shared UI, styles and notifications

Use the existing component library before adding a new control. Keep domain behavior in its feature and share repeated interaction or markup only when it has a clear common responsibility.

## Where to work

| Location | Responsibility |
| --- | --- |
| [shared/ui/](../../src/shared/ui/) | Dropdowns, color input, close buttons, dialog headings, mobile triggers and notifications |
| [vuetify.plugin.ts](../../src/app/plugins/vuetify.plugin.ts) | Registered components, theme combinations and repeated prop defaults |
| [styles/foundations/](../../src/assets/styles/foundations/) | Global base rules |
| [styles/components/](../../src/assets/styles/components/) | Shared control styles |
| [styles/overrides/](../../src/assets/styles/overrides/) | Global Vuetify and overlay overrides |
| [styles/features/](../../src/assets/styles/features/) | Feature page/component styles |
| [shared/themes/](../../src/shared/themes/) | Palette definitions and semantic variables |

Prefer Vuetify defaults for repeated props; use a wrapper for repeated markup/behavior. Forward required attributes, slots, models and events, including keyboard/focus and disabled/loading states. Register only used Vuetify components through specific component-group imports.

Keep unique styles scoped through external SCSS files. Follow the [SCSS and BEM guide](styles.md). Extract shared component styles with a scoped external stylesheet when needed; load feature styles from the feature to preserve lazy loading. Use theme variables and deliberately scoped global selectors for teleported menus. Avoid broad overrides or escalating specificity. See [frontend rules](frontend.md#components-and-styles) for stylesheet order and placement.

## Errors and notifications

[AppNotifications](../../src/shared/ui/AppNotifications.component.vue) renders the global snackbar. The [notification service](../../src/shared/services/notifications.service.ts) supports success/info/warning/error messages. Direct `show`/severity helpers replace the current message; use `enqueue` when several messages must be delivered in order (for example committed bonus effects).

For an imperative operation, report failure once at the UI owner with `notifications.error(t('…'))`. For errors already held in reactive state, watch them once with [useErrorNotifications](../../src/shared/composables/useErrorNotifications.ts):

```ts
useErrorNotifications(
  () => errorMessage.value,
  () => validationErrors.value,
);
```

The composable accepts reactive strings or validation-message arrays, removes duplicate messages and closes only its owned active notification when all watched errors clear. Do not also toast the same failure in the service and component. Keep errors in state for retry/disabled controls and retain invalid-field styling, but display error text through notifications rather than HTML alerts or field messages. Information and contextual warnings can remain inline.

Preserve unsaved drafts and retry buttons on failure. Notifications must remain readable above dialogs; they must not count as blocking overlays for canvas, preview or panel interactions. Keep error announcement semantics and multiline validation readable.

## Dropdowns

Use `AppDropdown` from `@/shared/ui/AppDropdown.component.vue` for selection fields. It shares Vuetify field defaults in `src/app/plugins/vuetify.plugin.ts` and the theme-aware field and menu styles in `src/assets/styles/components/app-dropdown.scss`. It loads `src/assets/styles/overrides/vuetify.scss` for action menus and teleported overlays.

```vue
<AppDropdown v-model="value" :items="options" item-title="name" item-value="id" :label="t('field.label')" />
<AppDropdown autocomplete v-model="values" :items="options" multiple clearable :label="t('field.label')" />
```

Multiple selection enables removable chips and a live selection count. Empty, loading, and unmatched-search messages use the current application language. Options can use Vuetify item properties or an `icon` property. Single selectors retain Vuetify's keyboard typeahead; `autocomplete` enables text filtering.

Field attributes and events are forwarded to Vuetify, including validation, disabled/readonly state, item mapping, object values, `v-model:search`, and `v-model:menu`. Use `:chips="false"` or `:closable-chips="false"` to override the multiple-selection defaults. All Vuetify slots remain available for domain-specific content such as color previews, category paths, and custom empty states. Custom item slots should bind the provided item props and retain `role="option"` and selection semantics.

The browser coverage in `tests/browser/shared/dropdowns.spec.ts` checks multiple selection, chip removal, clearing, keyboard selection, empty options, and mobile theme previews. Article and admin browser suites cover the existing custom dropdown slots and search behavior.


## Verification

Run `npm run test:frontend`, `npx playwright test tests/browser/shared` and `npm run build`. Test a real consumer when changing forwarded props/slots, and check desktop/mobile, keyboard focus, light/dark colors and errors inside dialogs. Review visual baselines as described in [testing](testing.md).
