<template>
  <nav :aria-label="t('admin.navigation.label')" class="admin-navigation">
    <v-list bg-color="transparent" color="primary" nav>
      <v-list-item :to="{ name: HomeRoutes.AdminUsers }" :active="route.name === HomeRoutes.AdminUsers" prepend-icon="mdi-account-group-outline" :title="t('admin.navigation.users')" @click="emit('navigate')" />
      <v-list-item :to="{ name: HomeRoutes.AdminArticles }" :active="articlesActive" :aria-current="route.name === HomeRoutes.AdminArticles ? 'page' : undefined" prepend-icon="mdi-file-document-multiple-outline" :title="t('admin.navigation.articles')" @click="emit('navigate')" />
      <v-list-item class="admin-navigation__child" :to="{ name: HomeRoutes.AdminArticles }" :active="route.name === HomeRoutes.AdminArticles" :title="t('admin.navigation.manageArticles')" @click="emit('navigate')" />
      <v-list-item v-if="isOwner" class="admin-navigation__child" :to="{ name: HomeRoutes.AdminArticleCategories }" :active="route.name === HomeRoutes.AdminArticleCategories" :title="t('articleCategories.manage')" @click="emit('navigate')" />
    </v-list>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { HomeRoutes } from '@/shared/navigation/routes';
import { useCurrentUserRole } from '@/features/auth';
const { isOwner } = useCurrentUserRole();
const emit = defineEmits<{ navigate: [] }>();
const { t } = useI18n();
const route = useRoute();
const articlesActive = computed(() => route.name === HomeRoutes.AdminArticles || route.name === HomeRoutes.AdminArticleWrite || route.name === HomeRoutes.AdminArticleCategories);
</script>

<style scoped lang="scss" src="@/assets/styles/features/admin/admin-navigation.scss"></style>
