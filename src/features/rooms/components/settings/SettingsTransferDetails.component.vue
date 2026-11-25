<template>
  <dl class="settings-transfer-details">
    <template v-for="(item, key) in visible" :key="key">
      <dt>{{ label(String(key)) }}</dt>
      <dd><SettingsTransferDetails v-if="item && typeof item === 'object'" :value="item" /><span v-else>{{ typeof item === 'boolean' ? t(item ? 'settingsTransfer.yes' : 'settingsTransfer.no') : item ?? '—' }}</span></dd>
    </template>
  </dl>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
const props = defineProps<{ value: object }>();
const { t, te } = useI18n();
const visible = computed(() => Object.fromEntries(Object.entries(props.value).filter(([key]) => !['id', 'roomId', 'list'].includes(key))));
function label(key: string) { return te('settingsTransfer.fields.' + key) ? t('settingsTransfer.fields.' + key) : key.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()); }
</script>
<style scoped lang="scss" src="@/assets/styles/features/rooms/settings/settings-transfer-details.scss"></style>
