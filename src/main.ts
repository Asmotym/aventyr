import { createApp } from 'vue'
import 'assets/styles/_vendor.scss'
import 'vuetify/dist/vuetify.css'
import '@mdi/font/css/materialdesignicons.css'
import 'assets/styles/dropdowns.scss'
import App from './App.vue'
import router from './router'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import i18n from 'modules/language-switcher/plugins/i18n.plugin'
import store from 'core/plugins/store.plugin'
import { getInitialVuetifyTheme } from 'core/services/theme.service'
import * as themes from './themes'

const dropdownDefaults = {
    variant: 'outlined',
    density: 'comfortable',
    color: 'primary',
    menuProps: { maxHeight: 360 },
    VChip: { color: 'primary', variant: 'tonal', size: 'small' },
}

const vutify = createVuetify({
    components,
    directives,
    icons: {
        defaultSet: 'mdi',
    },
    theme: {
        defaultTheme: getInitialVuetifyTheme(),
        themes: {
            aventyrDark: themes.aventyrDark,
            aventyrLight: themes.aventyrLight,
            arcaneDark: themes.arcaneDark,
            arcaneLight: themes.arcaneLight,
            explorerDark: themes.explorerDark,
            explorerLight: themes.explorerLight,
            kingdomDark: themes.kingdomDark,
            kingdomLight: themes.kingdomLight,
            campfireDark: themes.campfireDark,
            campfireLight: themes.campfireLight,
        },
        /*
        * Vuetify will generate:
        *
        * bg-primary-lighten-1
        * bg-primary-darken-1
        * text-accent-lighten-2
        * text-success-darken-2
        * etc.
        */
        variations: {
            colors: [
                'primary',
                'secondary',
                'accent',
                'success',
                'warning',
                'error',
                'info',

                'arcane',
                'mana',
                'forest',
                'moss',
                'royal',
                'crown',
                'ember',
                'flame',
            ],

            lighten: 2,
            darken: 2,
        },
    },
    defaults: {
        VBtn: {
            elevation: 0,
        },

        VCard: {
            rounded: 'lg',
            elevation: 1,
        },

        VDialog: {
            maxWidth: 700,
        },

        VMenu: {
            offset: 8,
        },

        VTextField: {
            variant: 'outlined',
            density: 'comfortable',
            color: 'primary',
        },

        VTextarea: {
            variant: 'outlined',
            density: 'comfortable',
            color: 'primary',
        },

        VSelect: dropdownDefaults,
        VAutocomplete: dropdownDefaults,
        VCombobox: dropdownDefaults,

        VCheckbox: {
            color: 'primary',
        },

        VRadio: {
            color: 'primary',
        },

        VSwitch: {
            color: 'primary',
            inset: true,
        },

        VSlider: {
            color: 'primary',
        },

        VProgressCircular: {
            color: 'primary',
        },

        VProgressLinear: {
            color: 'primary',
        },

        VTooltip: {
            location: 'top',
        },

        VExpansionPanels: {
            bgColor: 'surface-variant',
        },
    },
})

const app = createApp(App)
app.use(router)
app.use(vutify)
app.use(i18n)
app.use(store)
app.mount('#app')
