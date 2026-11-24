<template>
  <HeaderComponent />
  <v-container class="py-6 admin__page">
    <div class="admin__heading">
      <h1 class="text-h4">{{ t('admin.title') }}</h1>
    </div>
    <MobileSideButton v-if="!mdAndUp" id="admin-menu-toggle" :label="t('admin.navigation.openMenu')" icon="mdi-menu" :expanded="drawer" controls="admin-mobile-navigation" />
    <div class="admin__shell" :class="{ 'admin__shell-desktop': mdAndUp }">
      <aside v-if="mdAndUp" class="admin__sidebar"><AdminNavigation /></aside>
      <section class="admin__content" :aria-label="t('admin.navigation.content')"><router-view /></section>
    </div>
    <v-dialog v-if="!mdAndUp" v-model="drawer" activator="#admin-menu-toggle" class="admin__drawer" width="280" :aria-label="t('admin.navigation.label')" transition="slide-x-transition">
      <v-card id="admin-mobile-navigation" class="admin__drawer-card">
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
import HeaderComponent from '@/app/components/Header.component.vue';
import MobileSideButton from '@/shared/ui/MobileSideButton.component.vue';
import AdminNavigation from '@/features/admin/components/AdminNavigation.component.vue';
const { t } = useI18n();
const { mdAndUp } = useDisplay();
const route = useRoute();
const drawer = ref(false);
watch(() => route.fullPath, () => { drawer.value = false; });
watch(mdAndUp, () => { drawer.value = false; });
</script>

<style scoped lang="scss" src="@/assets/styles/features/admin/admin.scss"></style>
