<template>
  <v-window-item eager value="rollAwards" class="awards-settings">
    <section class="mb-6">
      <header class="awards-hero"><div class="awards-hero__icon"><v-icon icon="mdi-trophy-outline" size="38" /></div><div class="awards-hero__copy"><h2>{{ context.t('rollAwards.title') }}</h2><p>{{ context.t('rollAwards.settings.description') }}</p></div><span class="awards-count">{{ context.rollAwardsManager.awards.value.length }}</span></header>
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
        class="awards-toggle"
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
      <div class="awards-toolbar">
        <v-btn
          variant="tonal"
          color="primary"
          size="small"
          prepend-icon="mdi-content-copy"
          :disabled="
            !context.access.value.rights.copyRollAwards ||
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
        <section class="awards-gallery" :aria-label="context.t('rollAwards.form.existing')">
          <div class="gallery-heading"><h3><v-icon icon="mdi-trophy-variant-outline" color="primary" />{{ context.t('rollAwards.form.existing') }}</h3><v-chip size="small" variant="tonal">{{ context.rollAwardsManager.awards.value.length }}</v-chip></div>
          <div class="awards-grid">
                  <v-list-item
                    v-for="award in context.rollAwardsManager.awards.value"
                    :key="award.id"
                    class="roll-awards-list-item"
                  >
                    <v-list-item-title class="award-card-heading">
                      <span class="award-name"><v-icon icon="mdi-medal-outline" size="24" />{{ award.name }}</span>
                      <div class="d-flex align-center">
                        <v-btn
                          icon="mdi-pencil"
                          :aria-label="context.t('bag.edit')"
                          variant="text"
                          color="primary"
                          size="small"
                          class="mr-1"
                          :disabled="!context.canManageRollAwards.value || context.rollAwardsManager.awardMutationLoading.value"
                          @click="editAward(award)"
                        />
                        <v-btn
                          icon="mdi-delete"
                          :aria-label="context.t('bag.remove')"
                          variant="text"
                          color="error"
                          size="small"
                          :disabled="!context.canManageRollAwards.value || context.rollAwardsManager.awardMutationLoading.value"
                          @click="context.rollAwardsManager.deleteAward(award.id)"
                        />
                      </div>
                    </v-list-item-title>
                    <div v-if="award.description" class="award-description text-body-2 text-medium-emphasis mb-1">
                      {{ award.description }}
                    </div>
                    <div class="award-results">
                      <v-chip
                        v-for="value in award.diceResults"
                        :key="`${award.id}-${value}`"
                        size="small"
                        variant="tonal"
                        color="secondary"
                        class="award-result"
                      >
                        {{ value }}
                      </v-chip>
                    </div>
                    <div class="award-notation text-caption text-medium-emphasis mb-1"><v-icon icon="mdi-dice-multiple-outline" size="16" />
                      <span v-if="context.getAwardNotations(award).length">{{ context.t('rollAwards.onlyCountsUsing', { notations: context.formatAwardNotations(award) }) }}</span>
                      <span v-else>{{ context.t('rollAwards.countsEveryNotation') }}</span>
                    </div>
                  </v-list-item>
            <button v-if="context.canManageRollAwards.value" class="award-create-tile" type="button" :disabled="context.rollAwardsManager.awardMutationLoading.value" @click="createAward"><span class="award-create-icon"><v-icon icon="mdi-plus" size="30" /></span><strong>{{ context.t('rollAwards.form.createTitle') }}</strong><span>{{ context.t('rollAwards.form.help') }}</span></button>
          </div>
          <p v-if="!context.rollAwardsManager.awards.value.length" class="text-body-2 text-medium-emphasis mt-4">{{ context.t('rollAwards.form.empty') }}</p>
        </section>
        <v-dialog :model-value="editorOpen" :fullscreen="smAndDown" max-width="720" scrollable :transition="smAndDown ? 'dialog-bottom-transition' : 'dialog-transition'" :aria-label="context.t('rollAwards.form.createTitle')" @update:model-value="closeEditor">
          <v-card class="award-popup">
            <v-card-title class="award-popup-heading"><span class="award-popup-icon"><v-icon icon="mdi-trophy-outline" size="34" /></span><div><div class="award-popup-eyebrow">{{ context.t('rollAwards.title') }}</div><h2>{{ context.isEditingRollAward.value ? context.t('rollAwards.form.update') : context.t('rollAwards.form.createTitle') }}</h2></div><v-btn icon="mdi-close" variant="text" :aria-label="context.t('common.close')" :disabled="busy" @click="closeEditor" /></v-card-title>
            <v-divider />
            <v-card-text class="award-popup-body">

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
              </div>
            </v-card-text>
            <v-divider />
            <v-card-actions class="award-popup-footer"><v-spacer /><v-btn variant="text" :disabled="busy" @click="closeEditor">{{ context.t('common.cancel') }}</v-btn><v-btn color="primary" variant="flat" prepend-icon="mdi-check" :disabled="!context.canManageRollAwards.value || busy" :loading="busy" @click="saveAward">{{ context.isEditingRollAward.value ? context.t('rollAwards.form.update') : context.t('rollAwards.form.save') }}</v-btn></v-card-actions>
          </v-card>
        </v-dialog>
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
import { computed, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import type { RoomRollAward } from 'netlify/core/types/data.types';
import type { RoomSettingsContext } from '../RoomSettingsDialog.component.vue';

const props = defineProps<{
  context: RoomSettingsContext;
}>();

const { smAndDown } = useDisplay();
const editorOpen = ref(false), baseline = ref('');
const busy = computed(() => props.context.rollAwardsManager.awardMutationLoading.value);
function snapshot() { const c = props.context; return JSON.stringify([c.newRollAwardName.value, c.newRollAwardDescription.value, c.newRollAwardDiceNotation.value, c.newRollAwardNumbers.value, c.newRollAwardNumber.value]); }
function createAward() { props.context.clearRollAwardForm(); baseline.value = snapshot(); editorOpen.value = true; }
function editAward(award: RoomRollAward) { props.context.startEditingRollAward(award); baseline.value = snapshot(); editorOpen.value = true; }
function closeEditor() { if (busy.value) return; if (snapshot() !== baseline.value && !window.confirm(props.context.t('roomRework.discard'))) return; editorOpen.value = false; props.context.clearRollAwardForm(); }
async function saveAward() { await props.context.handleSaveRollAward(); const c = props.context; if (!c.newRollAwardError.value && !c.rollAwardsManager.awardMutationError.value && !c.newRollAwardName.value) editorOpen.value = false; }
watch(() => props.context.room?.id, () => { editorOpen.value = false; });
</script>

<style scoped>
.awards-hero { display: flex; align-items: center; gap: 18px; padding: 24px; margin: -4px -4px 20px; border: 1px solid rgba(var(--v-theme-primary), .18); border-radius: 14px; background: linear-gradient(120deg, rgba(var(--v-theme-primary), .14), rgba(var(--v-theme-primary), .02)); }
.awards-hero__icon { display: grid; place-items: center; width: 72px; height: 72px; flex-shrink: 0; border-radius: 20px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .1); transform: rotate(-7deg); }
.awards-hero__copy { flex: 1; min-width: 0; }
.awards-hero h2 { font-size: 22px; letter-spacing: -.025em; margin-bottom: 6px; }
.awards-hero p { font-size: 13px; line-height: 1.6; color: rgba(var(--v-theme-on-surface), .65); }
.awards-count { font-size: 32px; font-weight: 700; font-variant-numeric: tabular-nums; color: rgb(var(--v-theme-primary)); }
.awards-toggle { padding: 6px 16px; border-radius: 12px; background: rgba(var(--v-theme-on-surface), .025); }
.awards-toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 12px 0; margin-bottom: 8px; }
.awards-toolbar .v-btn, .awards-create { border-radius: 10px; }
.awards-settings :deep(.v-expansion-panels) { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 14px; overflow: hidden; }
.awards-settings :deep(.v-expansion-panel-title) { font-weight: 600; min-height: 64px; }
.awards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 14px; background: transparent; padding: 4px 0; }
.roll-awards-list-item { border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-top: 3px solid rgba(var(--v-theme-primary), .45); border-radius: 12px !important; padding: 18px !important; align-items: start; transition: border-color 160ms, box-shadow 160ms; }
.roll-awards-list-item:hover { border-color: rgba(var(--v-theme-primary), .55); box-shadow: 0 4px 18px rgba(var(--v-theme-primary), .07); }
.award-card-heading { display: flex; justify-content: space-between; align-items: start; flex-wrap: wrap; gap: 8px; white-space: normal; margin-bottom: 10px; }
.award-name { display: flex; align-items: start; gap: 10px; font-weight: 650; font-size: 16px; overflow-wrap: anywhere; flex: 1; min-width: 100px; }
.award-name .v-icon { color: rgb(var(--v-theme-primary)); flex-shrink: 0; }
.award-description { line-height: 1.6; overflow-wrap: anywhere; }
.award-results { display: flex; flex-wrap: wrap; gap: 6px; margin: 16px 0; }
.award-result { font-family: ui-monospace, monospace; font-weight: 700; min-width: 34px; justify-content: center; border-radius: 8px; }
.award-notation { display: flex; align-items: start; gap: 8px; padding-top: 12px; border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.awards-empty { text-align: center; padding: 36px 20px; border: 1px dashed rgba(var(--v-border-color), .3); border-radius: 12px; color: rgba(var(--v-theme-on-surface), .5); }
.awards-empty p { margin-top: 14px; }
.award-editor :deep(.v-expansion-panel-text__wrapper) { background: rgba(var(--v-theme-primary), .025); padding-top: 20px; }
.roll-award-number-row { display: flex; align-items: center; gap: 12px; padding: 16px; border: 1px solid rgba(var(--v-theme-primary), .15); border-radius: 12px; background: rgba(var(--v-theme-primary), .04); }
.roll-award-number-input { flex: 1; min-width: 0; }
.roll-award-number-btn { border-radius: 12px; }
@media (max-width: 600px) { .awards-hero { padding: 16px; gap: 12px; } .awards-hero__icon { width: 48px; height: 56px; border-radius: 14px; } .awards-hero h2 { font-size: 19px; } .awards-count { font-size: 24px; } .roll-awards-list-item { padding: 14px !important; } }
@media (prefers-reduced-motion: reduce) { .roll-awards-list-item { transition: none; } }
</style>

<style scoped>
.awards-gallery { margin-top: 12px; }
.gallery-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 18px; }
.gallery-heading h3 { display: flex; align-items: center; gap: 10px; font-size: 17px; }
.award-create-tile { display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; gap: 12px; min-height: 190px; padding: 24px; border: 1px dashed rgba(var(--v-theme-primary), .4); border-top: 3px solid rgba(var(--v-theme-primary), .45); border-radius: 12px; background: rgba(var(--v-theme-primary), .035); color: rgb(var(--v-theme-primary)); cursor: pointer; transition: background 160ms; }
.award-create-tile:hover, .award-create-tile:focus-visible { background: rgba(var(--v-theme-primary), .09); }
.award-create-tile > span:last-child { color: rgba(var(--v-theme-on-surface), .6); font-size: 12px; line-height: 1.6; }
.award-create-icon, .award-popup-icon { display: grid; place-items: center; width: 56px; height: 56px; flex-shrink: 0; border-radius: 16px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .1); }
.award-popup { border-radius: 18px !important; }
.award-popup-heading { display: flex; align-items: center; gap: 16px; padding: 24px; white-space: normal; background: linear-gradient(120deg, rgba(var(--v-theme-primary), .12), transparent); }
.award-popup-heading > div { flex: 1; min-width: 0; }
.award-popup-heading h2 { font-size: 20px; line-height: 1.4; }
.award-popup-eyebrow { font-size: 10px; text-transform: uppercase; letter-spacing: .12em; font-weight: 700; color: rgb(var(--v-theme-primary)); margin-bottom: 4px; }
.award-popup-body { padding: 24px; }
.award-popup-footer { padding: 16px 24px; }
@media (max-width: 600px) { .award-popup { border-radius: 0 !important; } .award-popup-heading { padding: 18px 16px; gap: 12px; } .award-popup-heading h2 { font-size: 18px; } .award-popup-body { padding: 20px 16px; } }
@media (prefers-reduced-motion: reduce) { .award-create-tile { transition: none; } }
</style>
