<template>
  <TransitionGroup name="message-arrival" :css="messageAnimationsEnabled">
  <div v-for="(message, index) in messages" :key="`${roomId}:${message.id}`">
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
        v-if="message.type !== 'bonus_effect'"
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
          'is-system': message.type === 'bonus_effect',
          'has-critical': Boolean(getCriticalRule(message)),
          'is-critical-animating': isCriticalAnimating(message.id),
        }"
        :style="getMessageStyle(message)"
      >
        <div class="message-meta">
          <span class="text-subtitle-2">{{ message.type === 'bonus_effect' ? t('roomRework.system') : formatDisplayName(message.username, message.nickname) }}</span>
          <small class="text-medium-emphasis">{{ formatTimestamp(message.createdAt) }}</small>
        </div>
        <div v-if="message.type === 'item_share' && message.itemSnapshot" class="pa-3 bag-share-message">
          <v-icon icon="mdi-bag-personal" color="amber" class="mr-2" /><BagItemPreview :room-id="roomId" :item="message.itemSnapshot" />
        </div>
        <div v-else-if="message.type === 'text' || message.type === 'bonus_effect'" class="message-copy">
          {{ message.content || '...' }}
        </div>
        <div v-else-if="message.type === 'roll_award_usage'" class="pa-3">
          <v-icon color="primary" class="mr-2">mdi-trophy-outline</v-icon>
          {{ t('sessionAwards.usageMessage', { name: formatDisplayName(message.username, message.nickname, t('common.someone')), award: message.rollAwardUsage?.award.name }) }}
        </div>
        <div v-else-if="message.type === 'dice'" class="dice-message pa-3">
          <div class="d-flex align-center gap-2 mb-1">
            <v-icon color="accent" class="mr-2 dice-notation-icon">mdi-dice-multiple</v-icon>
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

<style scoped>
.message-arrival-enter-active {
  transition: opacity 220ms ease-out, transform 220ms ease-out;
}

.message-arrival-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

@media (prefers-reduced-motion: reduce) {
  .message-arrival-enter-active {
    transition: none;
  }

  .message-arrival-enter-from {
    opacity: 1;
    transform: none;
  }
}

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
  --message-base-bg: rgba(var(--v-theme-primary), 0.075);
  border-radius: 16px 4px 16px 16px;
}

.message-content {
  --message-base-bg: rgb(var(--v-theme-surface));
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background-color: var(--message-bg, var(--message-base-bg));
  border: 1px solid var(--message-border-color, rgba(var(--v-theme-primary), .1));
  border-radius: 4px 16px 16px 16px;
  padding: 14px 16px;
  flex: 1;
  max-width: 80%;
  min-width: 0;
  overflow-wrap: anywhere;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}

.message-content.is-system {
  max-width: 100%;
  border-style: dashed;
  border-radius: 12px;
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
  z-index: 2;
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
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 16px;
  margin-bottom: 8px;
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

<style scoped>
.bag-share-message { border-left: 3px solid #d9a441; background: #d9a44112; border-radius: 4px; }
</style>

<style scoped>
.session-separator { margin: 16px 0 24px; font-size: 10px; letter-spacing: .04em; }
.session-separator::before, .session-separator::after { border-top-color: rgba(var(--v-theme-primary), .15); }
.session-separator span { padding: 6px 12px; border: 1px solid rgba(var(--v-theme-primary), .12); border-radius: 8px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .04); }
.message-meta > span { font-size: 12px !important; font-weight: 700; }
.message-meta > small { font-size: 10px; letter-spacing: .015em; }
.message-row.is-self .message-meta > span { color: rgb(var(--v-theme-primary)); }
.message-copy { white-space: pre-wrap; font-size: 14px; line-height: 1.75; }
.dice-message { text-align: left; border: 1px solid rgba(var(--v-theme-accent), .1); border-radius: 12px; }
.dice-message .font-weight-medium { font-size: 13px; line-height: 1.6; }
.dice-result { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding-block: 6px; }
.dice-result > span { font-size: 11px; font-weight: 650; color: rgba(var(--v-theme-on-surface), .65); }
.dice-result__value { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 40px; padding: 4px 10px; border-radius: 10px; background: rgba(var(--v-theme-primary), .08); color: rgb(var(--v-theme-primary)); font-size: 26px; font-weight: 800; line-height: 1.2; font-variant-numeric: tabular-nums; }
.dice-message > .text-caption { color: rgba(var(--v-theme-on-surface), .6); font-size: 11px !important; line-height: 1.7; }
.dice-message .v-btn { border-radius: 9px; text-transform: none; letter-spacing: 0; font-size: 11px; }
@media (max-width: 599px) {
  .message-content { max-width: calc(100% - 44px); padding: 10px 12px; }
  .message-content.is-system { max-width: 100%; }
  .message-row { margin-bottom: 12px; }
  .message-copy { font-size: 13px; }
  .message-meta { gap: 3px 8px; }
  .dice-message { padding: 10px !important; }
}
</style>

<style scoped>
.message-content.has-critical { border-inline-start: 3px solid var(--critical-accent); }
.has-critical .dice-message { border-color: var(--message-border-color); }
.has-critical .dice-notation-icon { color: var(--critical-accent) !important; }
.has-critical .dice-result__value { color: var(--critical-on-accent); background: var(--critical-accent); box-shadow: 0 0 0 3px var(--dice-message-bg); }
.is-critical-animating .dice-result__value { animation: critical-result-reveal .9s cubic-bezier(.22, 1, .36, 1) both; }
@keyframes critical-result-reveal {
  0% { transform: scale(.8); opacity: .4; box-shadow: 0 0 0 0 var(--critical-glow); }
  40% { transform: scale(1.12); opacity: 1; box-shadow: 0 0 0 8px transparent, 0 0 20px var(--critical-glow); }
  70% { transform: scale(.98); }
  100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 3px var(--dice-message-bg); }
}
@media (prefers-reduced-motion: reduce) {
  .is-critical-animating .dice-result__value { animation: none; }
}
</style>
