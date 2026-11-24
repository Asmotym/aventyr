import { createApp } from 'vue'
import '@/assets/styles/foundations/base.scss'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'
import '@/assets/styles/components/dropdowns.scss'
import App from '@/App.vue'
import router from '@/app/router'
import i18n from '@/shared/i18n'
import store from '@/app/plugins/store.plugin'
import { vuetify } from '@/app/plugins/vuetify.plugin'

const app = createApp(App)
app.use(router)
app.use(vuetify)
app.use(i18n)
app.use(store)
app.mount('#app')
