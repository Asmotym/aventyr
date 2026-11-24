<template>
  <v-snackbar
    :key="notification?.id"
    :model-value="Boolean(notification)"
    :timeout="notification?.timeout ?? 3500"
    :color="notification?.type ?? 'info'"
    location="bottom right"
    @update:model-value="handleVisibility"
  >
    {{ notification?.message }}

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
