<template>
  <HeaderComponent />
  <v-container v-if="userLoggedIn" class="py-6 settings__container">
    <UserSettings />
  </v-container>
  <v-container v-else class="d-flex justify-center align-center settings__loading" >
    <v-card :title="t('home.not_logged_in_title')" :text="t('home.not_logged_in_message')" />
  </v-container>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import HeaderComponent from '@/app/components/Header.component.vue';
import UserSettings from '@/features/settings/components/UserSettings.component.vue';
import { DiscordService } from '@/features/auth';

const { t } = useI18n();
const discordService = DiscordService.getInstance();
const userLoggedIn = computed(() => discordService.user.value !== null);
</script>

<style scoped lang="scss" src="@/assets/styles/features/settings/settings.scss"></style>
