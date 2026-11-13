<template>
  <v-dialog v-model="open" max-width="640">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between ga-3">
        <span class="d-flex align-center ga-2">
          <v-icon icon="mdi-test-tube" color="warning" />
          {{ t('roomDevTools.title') }}
        </span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          :title="t('common.close')"
          :aria-label="t('common.close')"
          @click="open = false"
        />
      </v-card-title>

      <v-divider />

      <v-card-text class="room-dev-test-panel">
        <v-alert type="warning" variant="tonal" density="comfortable">
          {{ t('roomDevTools.devOnly') }}
        </v-alert>

        <v-alert
          v-if="memberOptions.length === 0"
          type="info"
          variant="tonal"
          density="comfortable"
        >
          {{ t('roomDevTools.noOtherMembers') }}
        </v-alert>

        <template v-else>
          <AppDropdown
            v-model="selectedUserId"
            :items="memberOptions"
            :label="t('roomDevTools.actAs')"
            variant="outlined"
            density="comfortable"
            hide-details
          />

          <section class="room-dev-test-panel__section">
            <div class="text-subtitle-1">{{ t('roomDevTools.messageTitle') }}</div>
            <v-text-field
              v-model="messageText"
              :label="t('roomDevTools.messageLabel')"
              variant="outlined"
              density="comfortable"
              hide-details
              :disabled="sending"
              @keyup.enter="sendMessage"
            />
            <v-btn
              color="warning"
              variant="tonal"
              prepend-icon="mdi-message-text-outline"
              :disabled="!canSendMessage"
              :loading="sending"
              @click="sendMessage"
            >
              {{ t('roomDevTools.sendMessage') }}
            </v-btn>
          </section>

          <v-divider />

          <section class="room-dev-test-panel__section">
            <div class="text-subtitle-1">{{ t('roomDevTools.diceTitle') }}</div>
            <div class="room-dev-test-panel__dice-fields">
              <v-text-field
                v-model="diceNotation"
                :label="t('dice.fields.notation')"
                placeholder="1d20"
                variant="outlined"
                density="comfortable"
                hide-details
                :disabled="sending"
                @keyup.enter="sendDice"
              />
              <v-text-field
                v-model="diceDescription"
                :label="t('dice.fields.descriptionOptional')"
                variant="outlined"
                density="comfortable"
                hide-details
                :disabled="sending"
                @keyup.enter="sendDice"
              />
            </div>
            <v-checkbox
              v-if="bonusPointsEnabled"
              v-model="skipBonusPointRules"
              :label="t('bonusPoints.skipRulesForRoll')"
              density="compact"
              hide-details
              :disabled="sending"
            />
            <v-alert
              v-if="diceError"
              type="error"
              variant="tonal"
              density="compact"
            >
              {{ diceError }}
            </v-alert>
            <v-btn
              color="warning"
              variant="tonal"
              prepend-icon="mdi-dice-multiple-outline"
              :disabled="!canSendDice"
              :loading="sending"
              @click="sendDice"
            >
              {{ t('roomDevTools.rollDice') }}
            </v-btn>
          </section>
        </template>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import AppDropdown from 'core/components/common/AppDropdown.component.vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomMemberDetails } from 'netlify/core/types/data.types';
import type { DiceRoll } from 'core/utils/dice.utils';
import { rollDiceNotation } from 'core/utils/dice.utils';
import { formatDisplayName } from 'core/utils/room-formatting.utils';

const props = defineProps<{
  members: RoomMemberDetails[];
  currentUserId: string | null;
  sending: boolean;
  bonusPointsEnabled: boolean;
}>();

const emit = defineEmits<{
  (event: 'send-message', userId: string, content: string): void;
  (event: 'send-dice', userId: string, roll: DiceRoll, skipBonusPointRules: boolean): void;
}>();

const open = defineModel<boolean>('open', { required: true });
const { t } = useI18n();

const selectedUserId = ref<string | null>(null);
const messageText = ref('');
const diceNotation = ref('1d20');
const diceDescription = ref('');
const diceError = ref<string | null>(null);
const skipBonusPointRules = ref(false);

const memberOptions = computed(() => props.members
  .filter((member) => member.userId !== props.currentUserId)
  .map((member) => ({
    title: formatDisplayName(member.username, member.nickname),
    value: member.userId,
  })));

const canSendMessage = computed(() => (
  Boolean(selectedUserId.value) && Boolean(messageText.value.trim()) && !props.sending
));
const canSendDice = computed(() => (
  Boolean(selectedUserId.value) && Boolean(diceNotation.value.trim()) && !props.sending
));

watch(
  memberOptions,
  (options) => {
    if (!options.some((option) => option.value === selectedUserId.value)) {
      selectedUserId.value = options[0]?.value ?? null;
    }
  },
  { immediate: true }
);

watch(diceNotation, () => {
  diceError.value = null;
});

function sendMessage() {
  const userId = selectedUserId.value;
  const content = messageText.value.trim();
  if (!userId || !content || props.sending) return;
  emit('send-message', userId, content);
  messageText.value = '';
}

function sendDice() {
  const userId = selectedUserId.value;
  const notation = diceNotation.value.trim();
  if (!userId || !notation || props.sending) return;

  try {
    const roll = rollDiceNotation(notation, undefined, diceDescription.value);
    diceError.value = null;
    emit('send-dice', userId, roll, skipBonusPointRules.value);
    skipBonusPointRules.value = false;
  } catch {
    diceError.value = t('roomDevTools.invalidDice');
  }
}
</script>

<style scoped>
.room-dev-test-panel {
  display: grid;
  gap: 20px;
}

.room-dev-test-panel__section {
  display: grid;
  gap: 12px;
}

.room-dev-test-panel__dice-fields {
  display: grid;
  grid-template-columns: minmax(140px, 1fr) minmax(180px, 2fr);
  gap: 12px;
}

@media (max-width: 599px) {
  .room-dev-test-panel__dice-fields {
    grid-template-columns: 1fr;
  }
}
</style>
