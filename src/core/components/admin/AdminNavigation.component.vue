<template>
  <nav :aria-label="t('admin.navigation.label')" class="admin-navigation">
    <v-list bg-color="transparent" color="primary" nav>
      <v-list-item :to="{ name: HomeRoutes.AdminUsers }" :active="route.name === HomeRoutes.AdminUsers" prepend-icon="mdi-account-group-outline" :title="t('admin.navigation.users')" @click="emit('navigate')" />
      <v-list-item :to="{ name: HomeRoutes.AdminArticles }" :active="articlesActive" :aria-current="route.name === HomeRoutes.AdminArticles ? 'page' : undefined" prepend-icon="mdi-file-document-multiple-outline" :title="t('admin.navigation.articles')" @click="emit('navigate')" />
      <v-list-item class="navigation-child" :to="{ name: HomeRoutes.AdminArticles }" :active="route.name === HomeRoutes.AdminArticles" :title="t('admin.navigation.manageArticles')" @click="emit('navigate')" />
    </v-list>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { HomeRoutes } from 'core/routes';
const emit = defineEmits<{ navigate: [] }>();
const { t } = useI18n();
const route = useRoute();
const articlesActive = computed(() => route.name === HomeRoutes.AdminArticles || route.name === HomeRoutes.AdminArticleWrite);
</script>

<style scoped>
.admin-navigation { padding: 16px 8px; }
.navigation-child { margin-left: 28px; border-left: 2px solid rgba(var(--v-theme-primary), .3); }
.admin-navigation :deep(a:focus-visible) { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -2px; }
</style>
