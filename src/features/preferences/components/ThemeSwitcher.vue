<template>
  <v-btn
    icon
    variant="text"
    class="mr-2"
    :title="switchTitle"
    :aria-label="switchTitle"
    @click="toggleTheme"
  >
    <v-icon :icon="icon" size="20" />
  </v-btn>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useAppTheme } from '@/features/preferences/composables/useAppTheme';

const { nextTheme, switchTitle, toggleTheme } = useAppTheme();
const icon = computed(() => nextTheme.value === 'dark' ? 'mdi-weather-night' : 'mdi-weather-sunny');
</script>
