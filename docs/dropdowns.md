# Dropdowns

Use `AppDropdown` from `core/components/common/AppDropdown.component.vue` for selection fields. It shares Vuetify field defaults in `src/main.ts` and the theme-aware field and menu styles in `src/assets/styles/dropdowns.scss`. The menu styles also cover action menus and teleported overlays.

```vue
<AppDropdown v-model="value" :items="options" item-title="name" item-value="id" :label="t('field.label')" />
<AppDropdown autocomplete v-model="values" :items="options" multiple clearable :label="t('field.label')" />
```

Multiple selection enables removable chips and a live selection count. Empty, loading, and unmatched-search messages use the current application language. Options can use Vuetify item properties or an `icon` property. Single selectors retain Vuetify's keyboard typeahead; `autocomplete` enables text filtering.

Field attributes and events are forwarded to Vuetify, including validation, disabled/readonly state, item mapping, object values, `v-model:search`, and `v-model:menu`. Use `:chips="false"` or `:closable-chips="false"` to override the multiple-selection defaults. All Vuetify slots remain available for domain-specific content such as color previews, category paths, and custom empty states. Custom item slots should bind the provided item props and retain `role="option"` and selection semantics.

The browser coverage in `tests/browser/dropdowns.spec.ts` checks multiple selection, chip removal, clearing, keyboard selection, empty options, and mobile theme previews. Article and admin browser suites cover the existing custom dropdown slots and search behavior.
