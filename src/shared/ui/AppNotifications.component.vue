<template>
  <v-snackbar
    :key="notification?.id"
    :model-value="Boolean(notification)"
    :timeout="notification?.timeout ?? 3500"
    :color="notification?.type ?? 'info'"
    location="bottom right"
    :z-index="5000"
    @update:model-value="handleVisibility"
  >
    <span class="app-notifications__app-notification-message" :role="notification?.type === 'error' ? 'alert' : undefined" aria-atomic="true">{{ notification?.message }}</span>

    <template #actions>
      <AppCloseButton @click="notifications.close()" />
    </template>
  </v-snackbar>
</template>

<script setup lang="ts">
import AppCloseButton from '@/shared/ui/AppCloseButton.vue';
import { computed } from 'vue';
import { notifications } from '@/shared/services/notifications.service';

const notification = computed(() => notifications.current.value);

function handleVisibility(value: boolean) {
  if (!value) {
    notifications.close();
  }
}
</script>

<style scoped lang="scss" src="@/assets/styles/components/app-notifications.scss"></style>
