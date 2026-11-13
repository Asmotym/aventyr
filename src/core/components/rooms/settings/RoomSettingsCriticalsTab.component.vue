<template>
  <v-window-item value="criticals">
    <section class="mb-6">
      <div class="text-subtitle-2 mb-2">{{ context.t('criticals.title') }}</div>
      <p class="text-caption text-medium-emphasis mb-3">
        {{ context.t('criticals.description') }}
      </p>
      <v-alert
        v-if="!context.canManageCriticals.value"
        type="info"
        variant="tonal"
        density="comfortable"
        class="mb-3"
      >
        {{ context.t('criticals.creatorOnly') }}
      </v-alert>
      <div class="critical-rule-form">
        <div class="critical-rule-form__row">
          <v-text-field
            v-model="context.newCriticalThreshold.value"
            type="number"
            :label="context.t('criticals.number')"
            variant="outlined"
            density="comfortable"
            :placeholder="context.t('criticals.numberPlaceholder')"
            :disabled="!context.canManageCriticals.value || context.criticalsSaving.value"
          />
          <AppDropdown
            v-model="context.newCriticalOperator.value"
            :items="context.CRITICAL_OPERATOR_OPTIONS.value"
            item-title="title"
            item-value="value"
            :label="context.t('criticals.comparison')"
            variant="outlined"
            density="comfortable"
            :disabled="!context.canManageCriticals.value || context.criticalsSaving.value"
          />
        </div>
        <AppDropdown
          v-model="context.newCriticalColorMode.value"
          :items="context.CRITICAL_COLOR_MODE_OPTIONS.value"
          item-title="title"
          item-value="value"
          :label="context.t('criticals.colorSource')"
          variant="outlined"
          density="comfortable"
          class="mb-3"
          :disabled="!context.canManageCriticals.value || context.criticalsSaving.value"
        />

        <AppDropdown
          v-if="context.newCriticalColorMode.value === 'preset'"
          v-model="context.newCriticalPresetColor.value"
          :items="context.CRITICAL_PRESET_COLORS.value"
          item-title="title"
          item-value="value"
          :label="context.t('criticals.presetColor')"
          variant="outlined"
          density="comfortable"
          class="mb-3"
          :disabled="!context.canManageCriticals.value || context.criticalsSaving.value"
        />

        <div v-else class="mb-3">
          <div class="text-caption text-medium-emphasis mb-2">{{ context.t('criticals.customColor') }}</div>
          <input
            v-model="context.newCriticalCustomColor.value"
            type="color"
            class="critical-color-input"
            :disabled="!context.canManageCriticals.value || context.criticalsSaving.value"
          >
        </div>

        <div class="d-flex align-center flex-wrap gap-2 mb-4">
          <span class="text-caption text-medium-emphasis">{{ context.t('criticals.preview') }}</span>
          <v-chip
            size="small"
            variant="flat"
            :style="context.getCriticalColorChipStyle(context.selectedCriticalColor.value)"
          >
            {{ context.selectedCriticalColor.value.toUpperCase() }}
          </v-chip>
        </div>

        <v-alert
          v-if="context.criticalsError.value"
          type="error"
          density="comfortable"
          variant="tonal"
          class="mb-4"
        >
          {{ context.criticalsError.value }}
        </v-alert>

        <div class="d-flex flex-wrap gap-2">
          <v-btn
            color="primary"
            :disabled="!context.canManageCriticals.value || context.criticalsSaving.value"
            :loading="context.criticalsSaving.value"
            @click="context.addCriticalRule"
          >
            {{ context.t('criticals.addRule') }}
          </v-btn>
          <v-btn
            variant="text"
            :disabled="context.criticalsSaving.value"
            @click="context.resetCriticalForm"
          >
            {{ context.t('common.clear') }}
          </v-btn>
        </div>
      </div>
    </section>

    <section>
      <div class="d-flex align-center justify-space-between mb-2">
        <div class="text-subtitle-2">{{ context.t('criticals.savedRules') }}</div>
        <v-chip size="small">{{ context.roomCriticals.value.length }}/{{ context.ROOM_CRITICALS_MAX_ITEMS }}</v-chip>
      </div>
      <template v-if="context.roomCriticals.value.length > 0">
        <v-list density="comfortable">
          <v-list-item
            v-for="(critical, index) in context.roomCriticals.value"
            :key="`${critical.operator}-${critical.threshold}-${critical.color}-${index}`"
            class="critical-rule-item"
          >
            <v-list-item-title class="d-flex justify-space-between align-center flex-wrap gap-2">
              <span>{{ context.formatCriticalRule(critical) }}</span>
              <div class="d-flex align-center gap-2">
                <v-chip
                  size="small"
                  variant="flat"
                  :style="context.getCriticalColorChipStyle(critical.color)"
                >
                  {{ critical.color.toUpperCase() }}
                </v-chip>
                <v-btn
                  icon="mdi-delete"
                  variant="text"
                  color="error"
                  size="small"
                  :disabled="!context.canManageCriticals.value || context.criticalsSaving.value"
                  @click="context.removeCriticalRule(index)"
                />
              </div>
            </v-list-item-title>
            <div class="text-caption text-medium-emphasis">
              {{ context.t('criticals.ruleDescription', { operator: context.getCriticalOperatorText(critical.operator), threshold: critical.threshold }) }}
            </div>
          </v-list-item>
        </v-list>
      </template>
      <p v-else class="text-caption text-medium-emphasis">
        {{ context.t('criticals.empty') }}
      </p>
    </section>
  </v-window-item>
</template>

<script setup lang="ts">
import AppDropdown from 'core/components/common/AppDropdown.component.vue';
defineProps<{
  context: any;
}>();
</script>

<style scoped>
.critical-rule-form {
  border: 1px solid rgba(var(--v-theme-outline), 0.18);
  border-radius: 12px;
  padding: 16px;
}

.critical-rule-form__row {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.critical-rule-item {
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.18);
  margin-bottom: 12px;
  padding-bottom: 12px;
}

.critical-rule-item:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.critical-color-input {
  appearance: none;
  background: transparent;
  border: none;
  cursor: pointer;
  height: 42px;
  padding: 0;
  width: 72px;
}

.critical-color-input:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 640px) {
  .critical-rule-form__row {
    grid-template-columns: 1fr;
  }
}
</style>
