<template>
  <v-footer
    app
    border="t"
    color="surface"
    class="app-footer"
    :aria-label="t('footer.label')"
  >
    <nav class="app-footer__links" :aria-label="t('footer.label')">
      <v-btn
        :href="GITHUB_URL"
        target="_blank"
        rel="noopener noreferrer"
        variant="text"
        size="small"
        prepend-icon="mdi-github"
      >
        {{ t('footer.github') }}
      </v-btn>
      <v-btn
        :href="CONTACT_EMAIL"
        variant="text"
        size="small"
        prepend-icon="mdi-email-outline"
      >
        {{ t('footer.contact') }}
      </v-btn>
      <v-btn
        :to="{ name: HomeRoutes.TermsOfService }"
        variant="text"
        size="small"
      >
        {{ t('footer.termsOfService') }}
      </v-btn>
      <v-btn
        :to="{ name: HomeRoutes.PrivacyPolicy }"
        variant="text"
        size="small"
      >
        {{ t('footer.privacyPolicy') }}
      </v-btn>
    </nav>
  </v-footer>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { HomeRoutes } from '@/shared/navigation/routes';

const GITHUB_URL = 'https://github.com/Asmotym/aventyr';
const CONTACT_EMAIL = 'mailto:clement.boucherpro@gmail.com';
const { t } = useI18n();
</script>

<style scoped lang="scss" src="@/assets/styles/app/app-footer.scss"></style>
