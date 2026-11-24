<template>
  <section class="room-dev-test-panel">
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

      <v-btn color="warning" variant="tonal" prepend-icon="mdi-bag-personal" :disabled="!selectedUserId || !bagEnabled || sending" @click="selectedUserId && emit('open-bag', selectedUserId)">
        {{ t('roomDevTools.openBag') }}
      </v-btn>

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
  </section>
</template>
<script setup lang="ts">
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import AppDropdown from '@/shared/ui/AppDropdown.component.vue';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomMemberDetails } from '@shared/rooms/rooms.types';
import type { DiceRoll } from '@/features/rooms/utils/dice.utils';
import { rollDiceNotation } from '@/features/rooms/utils/dice.utils';
import { formatDisplayName } from '@/features/rooms/utils/room-formatting.utils';

const props = defineProps<{
  members: RoomMemberDetails[];
  currentUserId: string | null;
  sending: boolean;
  bonusPointsEnabled: boolean;
  bagEnabled: boolean;
}>();

const emit = defineEmits<{
  (event: 'open-bag', userId: string): void;
  (event: 'send-message', userId: string, content: string): void;
  (event: 'send-dice', userId: string, roll: DiceRoll, skipBonusPointRules: boolean): void;
}>();

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

useErrorNotifications(
  () => diceError.value,
);
</script>

<style scoped lang="scss" src="@/assets/styles/features/rooms/chat/room-dev-test-panel.scss"></style>
