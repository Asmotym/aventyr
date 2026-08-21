<template>
  <v-footer
    app
    border="t"
    color="surface"
    class="app-footer"
    :aria-label="t('footer.label')"
  >
    <nav class="footer-links" :aria-label="t('footer.label')">
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
import { HomeRoutes } from 'core/routes';

const GITHUB_URL = 'https://github.com/Asmotym/aventyr';
const CONTACT_EMAIL = 'mailto:clement.boucherpro@gmail.com';
const { t } = useI18n();
</script>

<style scoped>
.app-footer {
  justify-content: center;
  min-height: 40px;
  padding: 2px 12px;
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 0 4px;
}

@media (max-width: 599px) {
  .app-footer {
    padding-inline: 4px;
  }

  .footer-links :deep(.v-btn) {
    padding-inline: 8px;
  }
}
</style>
