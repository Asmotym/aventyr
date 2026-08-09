<template>
  <v-window-item value="rollAwards">
    <section class="mb-6">
      <div class="text-subtitle-2 mb-2">{{ context.t('rollAwards.title') }}</div>
      <p class="text-caption text-medium-emphasis mb-3">
        {{ context.t('rollAwards.settings.description') }}
      </p>
      <v-alert
        v-if="!context.isRoomCreator.value"
        type="info"
        variant="tonal"
        density="comfortable"
        class="mb-3"
      >
        {{ context.t('rollAwards.settings.creatorOnly') }}
      </v-alert>
      <v-switch
        :model-value="context.rollAwardsEnabled.value"
        :disabled="!context.canManageRollAwards.value || context.rollAwardsManager.toggleLoading.value"
        inset
        density="comfortable"
        color="primary"
        class="mb-2"
        @update:model-value="context.handleRollAwardsToggle"
      >
        <template #label>
          <span>{{ context.t('rollAwards.settings.enable') }}</span>
        </template>
      </v-switch>
      <v-alert
        v-if="context.rollAwardsManager.toggleError.value"
        type="error"
        density="comfortable"
        variant="tonal"
        class="mb-4"
      >
        {{ context.rollAwardsManager.toggleError.value }}
      </v-alert>
    </section>

    <template v-if="context.rollAwardsEnabled.value">
      <div class="d-flex flex-wrap gap-2 align-center mb-4">
        <v-btn
          variant="tonal"
          color="primary"
          size="small"
          prepend-icon="mdi-content-copy"
          :disabled="
            !context.canManageRollAwards.value ||
            context.rollAwardsManager.awardsLoading.value ||
            context.rollAwardsManager.awardMutationLoading.value ||
            context.clipboardLoading.value
          "
          :loading="context.clipboardLoading.value && context.clipboardAction.value === 'copy'"
          @click="context.copyRollAwardsToClipboard"
          class="mr-2"
        >
          {{ context.t('rollAwards.clipboard.copy') }}
        </v-btn>
        <v-btn
          variant="tonal"
          color="primary"
          size="small"
          prepend-icon="mdi-content-paste"
          :disabled="
            !context.canManageRollAwards.value ||
            context.rollAwardsManager.awardsLoading.value ||
            context.rollAwardsManager.awardMutationLoading.value ||
            context.clipboardLoading.value
          "
          :loading="context.clipboardLoading.value && context.clipboardAction.value === 'paste'"
          @click="context.handlePasteRollAwards"
        >
          {{ context.t('rollAwards.clipboard.paste') }}
        </v-btn>
      </div>
      <v-alert
        v-if="context.rollAwardsClipboardFeedback.value"
        :type="context.rollAwardsClipboardFeedback.value.type"
        density="comfortable"
        variant="tonal"
        class="mb-4"
      >
        {{ context.rollAwardsClipboardFeedback.value.message }}
      </v-alert>
      <v-alert
        v-if="context.rollAwardsImportError.value"
        type="error"
        density="comfortable"
        variant="tonal"
        class="mb-4"
      >
        {{ context.rollAwardsImportError.value }}
      </v-alert>
      <v-progress-linear
        v-if="context.rollAwardsManager.awardsLoading.value"
        indeterminate
        color="primary"
        class="mb-4"
      />
      <v-alert
        v-else-if="context.rollAwardsManager.awardsError.value"
        type="error"
        variant="tonal"
        density="comfortable"
        class="mb-4"
      >
        {{ context.rollAwardsManager.awardsError.value }}
        <template #append>
          <v-btn variant="text" size="small" @click="context.rollAwardsManager.ensureAwardsLoaded(true)">{{ context.t('common.retry') }}</v-btn>
        </template>
      </v-alert>
      <template v-else>
        <v-expansion-panels v-model="context.rollAwardsPanelsOpen.value" variant="accordion">
          <v-expansion-panel value="create">
            <v-expansion-panel-title>{{ context.t('rollAwards.form.createTitle') }}</v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="text-caption text-medium-emphasis mb-3">
                {{ context.t('rollAwards.form.help') }}
              </div>
              <div class="d-flex flex-column gap-3">
                <v-alert
                  v-if="context.isEditingRollAward.value"
                  type="info"
                  density="comfortable"
                  variant="tonal"
                  class="mb-2"
                >
                  {{ context.t('rollAwards.form.editing', { name: context.newRollAwardName.value || context.t('rollAwards.form.thisAward') }) }}
                </v-alert>
                <div class="roll-award-number-row mb-4">
                  <v-number-input
                    :label="context.t('rollAwards.form.diceResult')"
                    variant="outlined"
                    density="comfortable"
                    control-variant="stacked"
                    v-model="context.newRollAwardNumber.value"
                    :min="context.ROLL_AWARD_RESULT_MIN"
                    :max="context.ROLL_AWARD_RESULT_MAX"
                    :step="1"
                    :hide-details="true"
                    :disabled="!context.canManageRollAwards.value || context.rollAwardsManager.awardMutationLoading.value"
                    class="roll-award-number-input"
                    @keyup.enter.prevent="context.addRollAwardNumber"
                  />
                  <v-btn
                    color="primary"
                    icon="mdi-plus"
                    class="roll-award-number-btn"
                    :disabled="!context.canManageRollAwards.value || context.rollAwardsManager.awardMutationLoading.value"
                    :aria-label="context.t('rollAwards.form.addDiceResult')"
                    @click="context.addRollAwardNumber"
                  />
                </div>
                <div
                  v-if="context.newRollAwardNumbers.value.length > 0"
                  class="d-flex flex-wrap gap-2 mb-4"
                >
                  <v-chip
                    v-for="value in context.newRollAwardNumbers.value"
                    :key="value"
                    closable
                    color="primary"
                    variant="tonal"
                    class="mb-2 mr-2"
                    @click:close="context.removeRollAwardNumber(value)"
                  >
                    {{ value }}
                  </v-chip>
                </div>
                <v-text-field
                  v-model="context.newRollAwardDiceNotation.value"
                  :label="context.t('rollAwards.form.notationFilter')"
                  variant="outlined"
                  density="comfortable"
                  :placeholder="context.t('rollAwards.form.notationPlaceholder')"
                  :hint="context.t('rollAwards.form.notationHint')"
                  persistent-hint
                  :disabled="!context.canManageRollAwards.value || context.rollAwardsManager.awardMutationLoading.value"
                />
                <v-text-field
                  v-model="context.newRollAwardName.value"
                  :label="context.t('rollAwards.form.awardName')"
                  variant="outlined"
                  density="comfortable"
                  :placeholder="context.t('rollAwards.form.awardNamePlaceholder')"
                  :disabled="!context.canManageRollAwards.value || context.rollAwardsManager.awardMutationLoading.value"
                />
                <v-textarea
                  v-model="context.newRollAwardDescription.value"
                  :label="context.t('dice.fields.descriptionOptional')"
                  variant="outlined"
                  density="comfortable"
                  :placeholder="context.t('rollAwards.form.descriptionPlaceholder')"
                  :counter="context.ROLL_AWARD_DESCRIPTION_MAX_LENGTH"
                  :maxlength="context.ROLL_AWARD_DESCRIPTION_MAX_LENGTH"
                  auto-grow
                  :disabled="!context.canManageRollAwards.value || context.rollAwardsManager.awardMutationLoading.value"
                />
                <div class="text-caption text-medium-emphasis mb-2">
                  {{ context.t('rollAwards.form.ownerHelp') }}
                </div>
                <v-alert
                  v-if="context.newRollAwardError.value"
                  type="error"
                  density="comfortable"
                  variant="tonal"
                  class="mb-4"
                >
                  {{ context.newRollAwardError.value }}
                </v-alert>
                <v-alert
                  v-else-if="context.rollAwardsManager.awardMutationError.value"
                  type="error"
                  density="comfortable"
                  variant="tonal"
                >
                  {{ context.rollAwardsManager.awardMutationError.value }}
                </v-alert>
                <div class="d-flex flex-wrap gap-2">
                  <v-btn
                    color="primary"
                    :disabled="!context.canManageRollAwards.value || context.rollAwardsManager.awardMutationLoading.value"
                    :loading="context.rollAwardsManager.awardMutationLoading.value"
                    @click="context.handleSaveRollAward"
                  >
                    {{ context.isEditingRollAward.value ? context.t('rollAwards.form.update') : context.t('rollAwards.form.save') }}
                  </v-btn>
                  <v-btn
                    variant="text"
                    :disabled="context.rollAwardsManager.awardMutationLoading.value"
                    @click="context.clearRollAwardForm"
                  >
                    {{ context.isEditingRollAward.value ? context.t('rollAwards.form.cancelEdit') : context.t('common.clear') }}
                  </v-btn>
                </div>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
          <v-expansion-panel value="list">
            <v-expansion-panel-title>
              <span>{{ context.t('rollAwards.form.existing') }}</span>
              <v-chip class="ml-2">{{ context.rollAwardsManager.awards.value.length }}</v-chip>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <template v-if="context.rollAwardsManager.awards.value.length > 0">
                <v-list density="comfortable">
                  <v-list-item
                    v-for="award in context.rollAwardsManager.awards.value"
                    :key="award.id"
                    class="roll-awards-list-item"
                  >
                    <v-list-item-title class="d-flex justify-space-between">
                      <span class="d-flex align-center">{{ award.name }}</span>
                      <div class="d-flex align-center">
                        <v-btn
                          icon="mdi-pencil"
                          variant="text"
                          color="primary"
                          size="small"
                          class="mr-1"
                          :disabled="!context.canManageRollAwards.value || context.rollAwardsManager.awardMutationLoading.value"
                          @click="context.startEditingRollAward(award)"
                        />
                        <v-btn
                          icon="mdi-delete"
                          variant="text"
                          color="error"
                          size="small"
                          :disabled="!context.canManageRollAwards.value || context.rollAwardsManager.awardMutationLoading.value"
                          @click="context.rollAwardsManager.deleteAward(award.id)"
                        />
                      </div>
                    </v-list-item-title>
                    <div v-if="award.description" class="text-body-2 text-medium-emphasis mb-1">
                      {{ award.description }}
                    </div>
                    <div class="d-flex flex-wrap gap-2 mb-2">
                      <v-chip
                        v-for="value in award.diceResults"
                        :key="`${award.id}-${value}`"
                        size="small"
                        variant="tonal"
                        color="secondary"
                        class="mr-2 mt-2"
                      >
                        {{ value }}
                      </v-chip>
                    </div>
                    <div class="text-caption text-medium-emphasis mb-1">
                      <span v-if="context.getAwardNotations(award).length">{{ context.t('rollAwards.onlyCountsUsing', { notations: context.formatAwardNotations(award) }) }}</span>
                      <span v-else>{{ context.t('rollAwards.countsEveryNotation') }}</span>
                    </div>
                  </v-list-item>
                </v-list>
              </template>
              <p v-else class="text-caption text-medium-emphasis">
                {{ context.t('rollAwards.form.empty') }}
              </p>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </template>
    </template>
    <v-alert
      v-else
      type="info"
      variant="tonal"
      density="comfortable"
    >
      {{ context.t('rollAwards.settings.disabled') }}
    </v-alert>
  </v-window-item>
</template>

<script setup lang="ts">

defineProps<{
  context: any;
}>();

</script>

<style scoped>
.roll-awards-list-item {
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.18);
  margin-bottom: 12px;
  padding-bottom: 12px;
}

.roll-awards-list-item:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.roll-award-number-row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.roll-award-number-input {
  flex: 1;
}

.roll-award-number-btn {
  align-self: flex-end;
}
</style>
