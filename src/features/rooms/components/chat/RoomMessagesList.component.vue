<template>
  <TransitionGroup name="message-arrival" :css="messageAnimationsEnabled">
  <div v-for="(message, index) in messages" :key="`${roomId}:${message.id}`">
    <div
      v-if="isSessionStart(message, index)"
      class="room-messages-list__session-separator"
      role="separator"
      :aria-label="t('sessions.startedBanner')"
    >
      <span>{{ t('sessions.startedBanner') }}</span>
    </div>
    <div
      class="room-messages-list__row"
      :class="{ 'room-messages-list__row--self': message.userId === currentUserId }"
    >
      <UserProfileAvatar
        v-if="message.type !== 'bonus_effect'"
        :user-id="message.userId"
        :avatar="message.avatar"
        :display-name="formatDisplayName(message.username, message.nickname)"
        :room-id="roomId"
        :size="36"
        :classes="[message.userId === currentUserId ? 'ml-3' : 'mr-3']"
      />
      <div
        class="room-messages-list__content"
        :class="{
          'room-messages-list__content--system': message.type === 'bonus_effect',
          'room-messages-list__content--critical': Boolean(getCriticalRule(message)),
          'room-messages-list__content--critical-animating': isCriticalAnimating(message.id),
        }"
        :style="getMessageStyle(message)"
      >
        <div class="room-messages-list__meta">
          <span class="text-subtitle-2">{{ message.type === 'bonus_effect' ? t('roomRework.system') : formatDisplayName(message.username, message.nickname) }}</span>
          <small class="text-medium-emphasis">{{ formatTimestamp(message.createdAt) }}</small>
        </div>
        <div v-if="message.type === 'item_share' && message.itemSnapshot" class="pa-3 room-messages-list__bag-share-message">
          <v-icon icon="mdi-bag-personal" color="amber" class="mr-2" /><BagItemPreview :room-id="roomId" :item="message.itemSnapshot" />
        </div>
        <div v-else-if="message.type === 'text' || message.type === 'bonus_effect'" class="room-messages-list__copy">
          {{ message.content || '...' }}
        </div>
        <div v-else-if="message.type === 'roll_award_usage'" class="pa-3">
          <v-icon color="primary" class="mr-2">mdi-trophy-outline</v-icon>
          {{ t('sessionAwards.usageMessage', { name: formatDisplayName(message.username, message.nickname, t('common.someone')), award: message.rollAwardUsage?.award.name }) }}
        </div>
        <div v-else-if="message.type === 'dice'" class="room-messages-list__dice-message pa-3">
          <div class="d-flex align-center app-spacing--gap-2 mb-1 app-spacing">
            <v-icon color="accent" class="mr-2 room-messages-list__dice-notation-icon">mdi-dice-multiple</v-icon>
            <span v-if="message.content" class="font-weight-medium">
              {{ t('messages.rolledWithDescription', {
                name: formatDisplayName(message.username, message.nickname, t('common.someone')),
                notation: message.diceNotation,
                description: message.content,
              }) }}
            </span>
            <span v-else class="font-weight-medium">
              {{ t('messages.rolled', {
                name: formatDisplayName(message.username, message.nickname, t('common.someone')),
                notation: message.diceNotation,
              }) }}
            </span>
          </div>
          <div class="dice-result">
            <span>{{ t('messages.result') }}</span><strong class="dice-result__value">{{ message.diceTotal }}</strong>
            <v-chip
              v-if="message.pointUsed"
              size="x-small"
              color="primary"
              variant="tonal"
              class="ml-2"
            >
              {{ t('bonusPoints.pointUsedChip', { count: message.bonusPointsUsed ?? 0 }) }}
            </v-chip>
          </div>
          <div v-if="message.pointUsed" class="text-caption">
            {{ t('bonusPoints.pointUsedDetails', {
              base: message.diceBaseTotal,
              adjustment: formatAdjustment(message.bonusPointAdjustment),
            }) }}
          </div>
          <div class="text-caption">
            {{ t('messages.rolls') }}: {{ (message.diceRolls || []).join(', ') }}
          </div>
          <div v-if="canUseBonusPointOnMessage(message)" class="mt-2">
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              prepend-icon="mdi-star-four-points"
              :loading="bonusPointActionLoadingId === message.id"
              :disabled="Boolean(bonusPointActionLoadingId)"
              @click="emit('use-bonus-point', message)"
            >
              {{ t('bonusPoints.useOnRoll') }}
            </v-btn>
          </div>
        </div>
      </div>
    </div>
  </div>
  </TransitionGroup>
</template>

<script setup lang="ts">
import { evaluateBonusEffects } from '@shared/rooms/bonus-point-config';
import BagItemPreview from '@/features/rooms/components/bags/BagItemPreview.component.vue';
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomBonusPointConfiguration, RoomBonusPointRule, RoomCriticalRule, RoomMessage } from '@shared/rooms/rooms.types';
import { formatDisplayName, formatTimestamp } from '@/features/rooms/utils/room-formatting.utils';
import {
  findMatchingRoomCritical,
  getCriticalMessageStyle,
  getRoomCriticalRulesSignature,
  getRoomCriticalSignature,
} from '@/features/rooms/utils/room-criticals.utils';
import { getDiceFaceInfo, isNaturalExtremeRoll } from '@shared/rooms/bonus-point-dice';
import UserProfileAvatar from '@/features/profiles/components/UserProfileAvatar.component.vue';

const props = defineProps<{
  messages: RoomMessage[];
  roomId: string;
  currentUserId: string | null;
  roomCriticals: RoomCriticalRule[];
  criticalAnimationsEnabled: boolean;
  messageAnimationsEnabled: boolean;
  canUseBonusPoint: boolean;
  activeSessionId: string | null;
  allowExtremeBonusSpend: boolean;
  bonusPointRules: RoomBonusPointRule[];
  bonusConfiguration?: RoomBonusPointConfiguration;
  bonusPointActionLoadingId: string | null;
}>();

const emit = defineEmits<{
  (event: 'use-bonus-point', message: RoomMessage): void;
}>();

const { t } = useI18n();
const CRITICAL_ANIMATION_DURATION_MS = 1_300;

interface CriticalMessageSnapshot {
  rollSignature: string;
  criticalSignature: string | null;
}

const criticalSnapshots = new Map<string, CriticalMessageSnapshot>();
const criticalAnimationTimers = new Map<string, ReturnType<typeof setTimeout>>();
const animatingCriticalMessageIds = ref<Set<string>>(new Set());
let animationGeneration = 0;

function getCriticalRule(message: RoomMessage) {
  return findMatchingRoomCritical(message, props.roomCriticals);
}

function getMessageStyle(message: RoomMessage) {
  return getCriticalMessageStyle(getCriticalRule(message));
}

function getRollSignature(message: RoomMessage): string {
  return `${message.type}:${message.diceNotation ?? ''}:${String(message.diceTotal ?? '')}`;
}

function snapshotMessage(message: RoomMessage): CriticalMessageSnapshot {
  return {
    rollSignature: getRollSignature(message),
    criticalSignature: getRoomCriticalSignature(getCriticalRule(message)),
  };
}

function replaceAnimationIds(update: (ids: Set<string>) => void) {
  const ids = new Set(animatingCriticalMessageIds.value);
  update(ids);
  animatingCriticalMessageIds.value = ids;
}

function stopCriticalAnimation(messageId: string) {
  const timer = criticalAnimationTimers.get(messageId);
  if (timer) {
    clearTimeout(timer);
    criticalAnimationTimers.delete(messageId);
  }
  replaceAnimationIds((ids) => ids.delete(messageId));
}

function startCriticalAnimation(messageId: string) {
  const restart = animatingCriticalMessageIds.value.has(messageId);
  const generation = animationGeneration;
  stopCriticalAnimation(messageId);

  const activate = () => {
    const messageStillMatches = props.messages.some((message) => (
      message.id === messageId && Boolean(getCriticalRule(message))
    ));
    if (generation !== animationGeneration || !messageStillMatches) return;

    replaceAnimationIds((ids) => ids.add(messageId));
    const timer = setTimeout(() => {
      criticalAnimationTimers.delete(messageId);
      replaceAnimationIds((ids) => ids.delete(messageId));
    }, CRITICAL_ANIMATION_DURATION_MS);
    criticalAnimationTimers.set(messageId, timer);
  };

  if (restart) {
    void nextTick(activate);
    return;
  }
  activate();
}

function clearCriticalAnimations() {
  animationGeneration += 1;
  for (const timer of criticalAnimationTimers.values()) {
    clearTimeout(timer);
  }
  criticalAnimationTimers.clear();
  animatingCriticalMessageIds.value = new Set();
}

function baselineCriticalSnapshots() {
  criticalSnapshots.clear();
  for (const message of props.messages) {
    criticalSnapshots.set(message.id, snapshotMessage(message));
  }
}

function processMessageChanges() {
  const nextSnapshots = new Map<string, CriticalMessageSnapshot>();

  for (const message of props.messages) {
    const current = snapshotMessage(message);
    const previous = criticalSnapshots.get(message.id);
    nextSnapshots.set(message.id, current);

    if (!props.criticalAnimationsEnabled || !current.criticalSignature) {
      if (animatingCriticalMessageIds.value.has(message.id)) stopCriticalAnimation(message.id);
      continue;
    }

    const isNewCriticalMessage = !previous;
    const changedRollMatches = Boolean(previous && previous.rollSignature !== current.rollSignature);

    if (isNewCriticalMessage || changedRollMatches) {
      startCriticalAnimation(message.id);
    }
  }

  for (const messageId of criticalSnapshots.keys()) {
    if (!nextSnapshots.has(messageId)) {
      stopCriticalAnimation(messageId);
    }
  }

  criticalSnapshots.clear();
  for (const [messageId, snapshot] of nextSnapshots) {
    criticalSnapshots.set(messageId, snapshot);
  }
}

function isCriticalAnimating(messageId: string) {
  return animatingCriticalMessageIds.value.has(messageId);
}

watch(
  () => props.roomId,
  () => {
    clearCriticalAnimations();
    baselineCriticalSnapshots();
  }
);

watch(
  () => getRoomCriticalRulesSignature(props.roomCriticals),
  () => {
    clearCriticalAnimations();
    baselineCriticalSnapshots();
  }
);

watch(
  () => props.criticalAnimationsEnabled,
  () => {
    clearCriticalAnimations();
    baselineCriticalSnapshots();
  }
);

watch(
  () => props.messages.map(message => `${message.id}:${getRollSignature(message)}`),
  processMessageChanges
);

baselineCriticalSnapshots();

onBeforeUnmount(clearCriticalAnimations);

function formatAdjustment(value?: number | null) {
  const amount = Number(value ?? 0);
  return amount > 0 ? `+${amount}` : String(amount);
}

function isSessionStart(message: RoomMessage, index: number) {
  return Boolean(
    message.sessionId &&
    (index === 0 || props.messages[index - 1]?.sessionId !== message.sessionId)
  );
}

function canUseBonusPointOnMessage(message: RoomMessage) {
  if (props.bonusConfiguration?.version === 2) {
    if (!props.canUseBonusPoint || message.type !== 'dice' || message.sessionId !== props.activeSessionId || message.userId !== props.currentUserId || message.bonusPointRulesSkipped) return false;
    try { return evaluateBonusEffects(props.bonusConfiguration, message.diceNotation ?? '', Number(message.diceTotal), message.diceRolls ?? [], props.allowExtremeBonusSpend).eligible; }
    catch { return false; }
  }

  const diceInfo = getDiceFaceInfo(message.diceNotation);
  const rule = diceInfo
    ? props.bonusPointRules.find((current) => current.diceNotation === diceInfo.faceNotation)
    : null;
  const currentTotal = Number(message.diceTotal);
  const isAtDiceBoundary = Boolean(
    diceInfo &&
    Number.isFinite(currentTotal) &&
    (currentTotal === 1 || currentTotal === diceInfo.sides)
  );
  return props.canUseBonusPoint &&
    message.sessionId === props.activeSessionId &&
    message.type === 'dice' &&
    !message.bonusPointRulesSkipped &&
    message.userId === props.currentUserId &&
    Boolean(rule) &&
    !isAtDiceBoundary &&
    (props.allowExtremeBonusSpend || !isNaturalExtremeRoll(message.diceNotation, message.diceRolls));
}
</script>

<style scoped lang="scss" src="@/assets/styles/features/rooms/chat/room-messages-list.scss"></style>
