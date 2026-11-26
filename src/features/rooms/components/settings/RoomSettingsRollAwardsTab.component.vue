<template>
  <v-window-item eager value="rollAwards" class="room-settings-roll-awards-tab">
    <section class="mb-6">
      <header class="awards-hero"><div class="awards-hero__icon"><v-icon icon="mdi-trophy-outline" size="38" /></div><div class="awards-hero__copy"><h2>{{ context.t('rollAwards.title') }}</h2><p>{{ context.t('rollAwards.settings.description') }}</p></div><span class="room-settings-roll-awards-tab__count">{{ context.rollAwardsManager.awards.value.length }}</span></header>
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
        class="room-settings-roll-awards-tab__toggle"
        @update:model-value="context.handleRollAwardsToggle"
      >
        <template #label>
          <span>{{ context.t('rollAwards.settings.enable') }}</span>
        </template>
      </v-switch>

      <template v-if="context.rollAwardsEnabled.value">
        <v-switch
          :model-value="context.rollAwardsManager.allowNonLeaders.value"
          :label="context.t('rollAwards.settings.allowNonLeaders')"
          :hint="context.t('rollAwards.settings.allowNonLeadersHelp')"
          persistent-hint
          :disabled="!context.canManageRollAwards.value || context.rollAwardsManager.toggleLoading.value"
          inset
          color="primary"
          class="mb-4"
          @update:model-value="context.rollAwardsManager.setAllowNonLeaders(Boolean($event))"
        />
        <div class="room-settings-roll-awards-tab__toolbar">
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
          v-if="(context.rollAwardsClipboardFeedback.value) && context.rollAwardsClipboardFeedback.value.type !== 'error'"
          :type="context.rollAwardsClipboardFeedback.value.type"
          density="comfortable"
          variant="tonal"
          class="mb-4"
        >
          {{ context.rollAwardsClipboardFeedback.value.message }}
        </v-alert>

        <v-progress-linear
          v-if="context.rollAwardsManager.awardsLoading.value"
          indeterminate
          color="primary"
          class="mb-4"
        />
        <div v-else-if="context.rollAwardsManager.awardsError.value" class="error-recovery-actions"><v-btn variant="text" size="small" @click="context.rollAwardsManager.ensureAwardsLoaded(true)">{{ context.t('common.retry') }}</v-btn></div>
        <template v-else>
          <section class="room-settings-roll-awards-tab__gallery" :aria-label="context.t('rollAwards.form.existing')">
            <div class="room-settings-roll-awards-tab__gallery-heading"><h3><v-icon icon="mdi-trophy-variant-outline" color="primary" />{{ context.t('rollAwards.form.existing') }}</h3><v-chip size="small" variant="tonal">{{ context.rollAwardsManager.awards.value.length }}</v-chip></div>
            <div class="room-settings-roll-awards-tab__grid">
                    <v-list-item
                      v-for="award in context.rollAwardsManager.awards.value"
                      :key="award.id"
                      class="room-settings-roll-awards-tab__awards-list-item"
                    >
                      <v-list-item-title class="room-settings-roll-awards-tab__award-card-heading">
                        <span class="room-settings-roll-awards-tab__award-name"><v-icon icon="mdi-medal-outline" size="24" />{{ award.name }}</span>
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
                      <div v-if="award.description" class="room-settings-roll-awards-tab__award-description text-body-2 text-medium-emphasis mb-1">
                        {{ award.description }}
                      </div>
                      <div class="room-settings-roll-awards-tab__award-results">
                        <v-chip
                          v-for="value in award.diceResults"
                          :key="`${award.id}-${value}`"
                          size="small"
                          variant="tonal"
                          color="secondary"
                          class="room-settings-roll-awards-tab__award-result"
                        >
                          {{ value }}
                        </v-chip>
                      </div>
                      <div class="room-settings-roll-awards-tab__award-notation text-caption text-medium-emphasis mb-1"><v-icon icon="mdi-dice-multiple-outline" size="16" />
                        <span v-if="context.getAwardNotations(award).length">{{ context.t('rollAwards.onlyCountsUsing', { notations: context.formatAwardNotations(award) }) }}</span>
                        <span v-else>{{ context.t('rollAwards.countsEveryNotation') }}</span>
                      </div>
                    </v-list-item>
              <button v-if="context.canManageRollAwards.value" class="room-settings-roll-awards-tab__award-create-tile" type="button" :disabled="context.rollAwardsManager.awardMutationLoading.value" @click="createAward"><span class="room-settings-roll-awards-tab__award-create-icon"><v-icon icon="mdi-plus" size="30" /></span><strong>{{ context.t('rollAwards.form.createTitle') }}</strong><span>{{ context.t('rollAwards.form.help') }}</span></button>
            </div>
            <p v-if="!context.rollAwardsManager.awards.value.length" class="text-body-2 text-medium-emphasis mt-4">{{ context.t('rollAwards.form.empty') }}</p>
          </section>
          <v-dialog :model-value="editorOpen" :fullscreen="smAndDown" max-width="720" scrollable :transition="smAndDown ? 'dialog-bottom-transition' : 'dialog-transition'" :aria-label="context.t('rollAwards.form.createTitle')" @update:model-value="closeEditor">
            <v-card class="room-settings-roll-awards-tab__award-popup">
              <AppDialogHeading class="room-settings-roll-awards-tab__award-popup-heading"><span class="room-settings-roll-awards-tab__award-popup-icon"><v-icon icon="mdi-trophy-outline" size="34" /></span><div><div class="room-settings-roll-awards-tab__award-popup-eyebrow">{{ context.t('rollAwards.title') }}</div><h2>{{ context.isEditingRollAward.value ? context.t('rollAwards.form.update') : context.t('rollAwards.form.createTitle') }}</h2></div><v-btn icon="mdi-close" variant="text" :aria-label="context.t('common.close')" :disabled="busy" @click="closeEditor" /></AppDialogHeading>
              <v-divider />
              <v-card-text class="room-settings-roll-awards-tab__award-popup-body">

                <div class="text-caption text-medium-emphasis mb-3">
                  {{ context.t('rollAwards.form.help') }}
                </div>
                <div class="d-flex flex-column app-spacing--gap-3 app-spacing">
                  <v-alert
                    v-if="context.isEditingRollAward.value"
                    type="info"
                    density="comfortable"
                    variant="tonal"
                    class="mb-2"
                  >
                    {{ context.t('rollAwards.form.editing', { name: context.newRollAwardName.value || context.t('rollAwards.form.thisAward') }) }}
                  </v-alert>
                  <div class="room-settings-roll-awards-tab__award-number-row mb-4">
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
                      class="room-settings-roll-awards-tab__award-number-input"
                      @keyup.enter.prevent="context.addRollAwardNumber"
                    />
                    <v-btn
                      color="primary"
                      icon="mdi-plus"
                      class="room-settings-roll-awards-tab__award-number-btn"
                      :disabled="!context.canManageRollAwards.value || context.rollAwardsManager.awardMutationLoading.value"
                      :aria-label="context.t('rollAwards.form.addDiceResult')"
                      @click="context.addRollAwardNumber"
                    />
                  </div>
                  <div
                    v-if="context.newRollAwardNumbers.value.length > 0"
                    class="d-flex flex-wrap app-spacing--gap-2 mb-4 app-spacing"
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


                </div>
              </v-card-text>
              <v-divider />
              <v-card-actions class="room-settings-roll-awards-tab__award-popup-footer"><v-spacer /><v-btn variant="text" :disabled="busy" @click="closeEditor">{{ context.t('common.cancel') }}</v-btn><v-btn color="primary" variant="flat" prepend-icon="mdi-check" :disabled="!context.canManageRollAwards.value || busy" :loading="busy" @click="saveAward">{{ context.isEditingRollAward.value ? context.t('rollAwards.form.update') : context.t('rollAwards.form.save') }}</v-btn></v-card-actions>
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
    </section>
  </v-window-item>
</template>

<script setup lang="ts">
import AppDialogHeading from '@/shared/ui/AppDialogHeading.vue';
import { computed, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import type { RoomRollAward } from '@shared/rooms/rooms.types';
import type { RoomSettingsContext } from '@/features/rooms/composables/useRoomSettings';

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

<style scoped lang="scss" src="@/assets/styles/features/rooms/settings/room-settings-roll-awards-tab.scss"></style>
