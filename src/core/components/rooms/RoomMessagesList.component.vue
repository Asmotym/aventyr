<template>
  <template v-for="(message, index) in messages" :key="message.id">
    <div
      v-if="isSessionStart(message, index)"
      class="session-separator"
      role="separator"
      :aria-label="t('sessions.startedBanner')"
    >
      <span>{{ t('sessions.startedBanner') }}</span>
    </div>
    <div
      class="message-row"
      :class="{ 'is-self': message.userId === currentUserId }"
    >
      <UserProfileAvatar
        :user-id="message.userId"
        :avatar="message.avatar"
        :display-name="formatDisplayName(message.username, message.nickname)"
        :room-id="roomId"
        :size="36"
        :classes="[message.userId === currentUserId ? 'ml-3' : 'mr-3']"
      />
      <div
        class="message-content"
        :class="{
          'has-critical': Boolean(getCriticalRule(message)),
          'is-critical-animating': isCriticalAnimating(message.id),
        }"
        :style="getMessageStyle(message)"
      >
        <div class="message-meta">
          <span class="text-subtitle-2">{{ formatDisplayName(message.username, message.nickname) }}</span>
          <small class="text-medium-emphasis">{{ formatTimestamp(message.createdAt) }}</small>
        </div>
        <div v-if="message.type === 'text'">
          {{ message.content || '...' }}
        </div>
        <div v-else-if="message.type === 'roll_award_usage'" class="pa-3">
          <v-icon color="primary" class="mr-2">mdi-trophy-outline</v-icon>
          {{ t('sessionAwards.usageMessage', { name: formatDisplayName(message.username, message.nickname, t('common.someone')), award: message.rollAwardUsage?.award.name }) }}
        </div>
        <div v-else-if="message.type === 'dice'" class="dice-message pa-3">
          <div class="d-flex align-center gap-2 mb-1">
            <v-icon color="accent" class="mr-2">mdi-dice-multiple</v-icon>
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
          <div class="text-body-2">
            {{ t('messages.result') }}: <strong>{{ message.diceTotal }}</strong>
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
  </template>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomBonusPointRule, RoomCriticalRule, RoomMessage } from 'netlify/core/types/data.types';
import { formatDisplayName, formatTimestamp } from 'core/utils/room-formatting.utils';
import {
  findMatchingRoomCritical,
  getCriticalMessageStyle,
  getRoomCriticalRulesSignature,
  getRoomCriticalSignature,
} from 'core/utils/room-criticals.utils';
import { getDiceFaceInfo, isNaturalExtremeRoll } from 'netlify/core/utils/bonus-point-dice';
import UserProfileAvatar from 'core/components/UserProfileAvatar.component.vue';

const props = defineProps<{
  messages: RoomMessage[];
  roomId: string;
  currentUserId: string | null;
  roomCriticals: RoomCriticalRule[];
  criticalAnimationsEnabled: boolean;
  canUseBonusPoint: boolean;
  activeSessionId: string | null;
  allowExtremeBonusSpend: boolean;
  bonusPointRules: RoomBonusPointRule[];
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
  return `${message.type}:${String(message.diceTotal ?? '')}`;
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
      continue;
    }

    const isNewCriticalMessage = !previous;
    const changedRollNowMatchesDifferentRule = Boolean(
      previous &&
      previous.rollSignature !== current.rollSignature &&
      previous.criticalSignature !== current.criticalSignature
    );

    if (isNewCriticalMessage || changedRollNowMatchesDifferentRule) {
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
  () => props.messages,
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

<style scoped>
.session-separator {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0 20px;
  color: rgb(var(--v-theme-on-surface-variant));
  font-size: 0.75rem;
}

.session-separator::before,
.session-separator::after {
  content: '';
  flex: 1;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.2);
}

.message-row {
  display: flex;
  margin-bottom: 16px;
}

.message-row.is-self {
  flex-direction: row-reverse;
  text-align: right;
}

.message-row.is-self .mr-3 {
  margin-right: 0;
  margin-left: 12px;
}

.message-row.is-self .message-content {
  --message-base-bg: rgba(var(--v-theme-primary), 0.1);
}

.message-content {
  --message-base-bg: rgba(var(--v-theme-surface-variant), 0.45);
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background-color: var(--message-bg, var(--message-base-bg));
  border: 1px solid var(--message-border-color, transparent);
  border-radius: 12px;
  padding: 12px;
  flex: 1;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.message-content > * {
  position: relative;
  z-index: 1;
}

.message-content.is-critical-animating {
  animation: critical-color-bloom 1.2s cubic-bezier(0.22, 1, 0.36, 1) both;
  will-change: background-color, border-color, box-shadow, transform;
}

.message-content.is-critical-animating::after {
  content: '';
  position: absolute;
  z-index: 0;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  background: linear-gradient(
    110deg,
    transparent 18%,
    var(--critical-sweep, rgba(255, 255, 255, 0.72)) 48%,
    transparent 72%
  );
  transform: translateX(-135%);
  animation: critical-edge-sweep 0.9s 0.08s cubic-bezier(0.22, 1, 0.36, 1) both;
}

@keyframes critical-color-bloom {
  0% {
    background-color: var(--message-base-bg);
    border-color: transparent;
    box-shadow: 0 0 0 0 transparent;
    transform: translateY(0) scale(1);
  }
  32% {
    background-color: var(--critical-reveal-bg, var(--message-bg));
    border-color: var(--message-border-color);
    box-shadow:
      0 0 0 1px var(--critical-glow, transparent),
      0 8px 24px -8px var(--critical-glow, transparent);
    transform: translateY(-2px) scale(1.01);
  }
  68% {
    background-color: var(--message-bg);
    border-color: var(--message-border-color);
    box-shadow: 0 4px 16px -10px var(--critical-glow, transparent);
    transform: translateY(-1px) scale(1.004);
  }
  100% {
    background-color: var(--message-bg);
    border-color: var(--message-border-color);
    box-shadow: 0 0 0 0 transparent;
    transform: translateY(0) scale(1);
  }
}

@keyframes critical-edge-sweep {
  0% {
    opacity: 0;
    transform: translateX(-135%);
  }
  22% {
    opacity: 0.72;
  }
  100% {
    opacity: 0;
    transform: translateX(135%);
  }
}

.message-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.dice-message {
  background-color: var(--dice-message-bg, rgba(var(--v-theme-accent), 0.08));
  border-radius: 12px;
}

@media (prefers-reduced-motion: reduce) {
  .message-content.is-critical-animating {
    animation: none;
    will-change: auto;
  }

  .message-content.is-critical-animating::after {
    display: none;
    animation: none;
  }
}
</style>
