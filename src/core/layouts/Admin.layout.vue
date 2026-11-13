<template>
  <HeaderComponent />
  <v-container class="py-6 admin-page">
    <div class="admin-heading">
      <h1 class="text-h4">{{ t('admin.title') }}</h1>
      <v-btn v-if="!mdAndUp" id="admin-menu-toggle" variant="tonal" prepend-icon="mdi-menu" aria-haspopup="dialog" :aria-expanded="drawer" aria-controls="admin-mobile-navigation">{{ t('admin.navigation.openMenu') }}</v-btn>
    </div>
    <div class="admin-shell" :class="{ 'admin-shell-desktop': mdAndUp }">
      <aside v-if="mdAndUp" class="admin-sidebar"><AdminNavigation /></aside>
      <section class="admin-content" :aria-label="t('admin.navigation.content')"><router-view /></section>
    </div>
    <v-dialog v-if="!mdAndUp" v-model="drawer" activator="#admin-menu-toggle" class="admin-drawer" width="280" :aria-label="t('admin.navigation.label')" transition="slide-x-transition">
      <v-card id="admin-mobile-navigation" class="admin-drawer-card">
        <div class="d-flex justify-end pa-2"><v-btn icon="mdi-close" variant="text" :aria-label="t('admin.navigation.closeMenu')" @click="drawer = false" /></div>
        <AdminNavigation @navigate="drawer = false" />
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';
import HeaderComponent from 'core/components/Header.component.vue';
import AdminNavigation from 'core/components/admin/AdminNavigation.component.vue';
const { t } = useI18n();
const { mdAndUp } = useDisplay();
const route = useRoute();
const drawer = ref(false);
watch(() => route.fullPath, () => { drawer.value = false; });
watch(mdAndUp, () => { drawer.value = false; });
</script>

<style scoped>
.admin-page { max-width: 1400px; }
.admin-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px; margin-bottom: 24px; }
.admin-shell { display: grid; gap: 24px; align-items: start; }
.admin-shell-desktop { grid-template-columns: 240px minmax(0, 1fr); }
.admin-sidebar { background: rgb(var(--v-theme-surface)); border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 16px; }
.admin-content { min-width: 0; padding: 24px; border-radius: 16px; background: rgba(var(--v-theme-surface), .7); border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.admin-content :deep(.admin-card) { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 12px; background: rgb(var(--v-theme-surface)); }
.admin-drawer :deep(.v-overlay__content) { align-self: stretch; margin: 0; height: 100dvh; max-height: 100dvh; top: 0; left: 0; }
.admin-drawer-card { height: 100%; border-radius: 0 !important; overflow-y: auto; }
@media (max-width: 599px) { .admin-content { padding: 16px; } .admin-heading h1 { font-size: 1.7rem !important; } }
</style>
