<template>
  <v-card class="room-chat-panel">
    <template v-if="room">
      <Transition name="session-header" mode="out-in">
      <v-card-title v-if="showSessionBanner" key="session-banner" class="session-start-banner">
        <v-icon icon="mdi-timer-play-outline" />
        <span>{{ t('sessions.startedBanner') }}</span>
      </v-card-title>
      <v-card-title v-else key="room-header" class="d-flex justify-space-between align-center flex-wrap gap-2">
        <div>
          <div class="d-flex align-center ga-2">
            <div class="text-h6">{{ room.name }}</div>
            <v-chip
              size="x-small"
              variant="tonal"
              :color="realtimeIndicator.color"
              :prepend-icon="realtimeIndicator.icon"
            >
              {{ realtimeIndicator.label }}
            </v-chip>
          </div>
          <div class="text-medium-emphasis d-flex align-center gap-2">
            <small>{{ t('chat.inviteCode', { code: displayedInviteCode }) }}</small>
            <v-btn
              variant="text"
              size="x-small"
              :icon="showInviteCode ? 'mdi-eye-off' : 'mdi-eye'"
              :disabled="!room?.inviteCode"
              :title="showInviteCode ? t('chat.hideInviteCode') : t('chat.showInviteCode')"
              :aria-label="showInviteCode ? t('chat.hideInviteCode') : t('chat.showInviteCode')"
              @click="toggleInviteVisibility"
            />
          </div>
        </div>
        <div class="d-flex align-center ga-2">
          <span v-if="roomsStore.currentSession" class="session-timer" aria-live="off">{{ sessionDuration }}</span>
          <v-btn
            v-if="isRoomCreator"
            :color="roomsStore.currentSession ? 'error' : 'primary'"
            :variant="roomsStore.currentSession ? 'tonal' : 'flat'"
            :prepend-icon="roomsStore.currentSession ? 'mdi-stop-circle-outline' : 'mdi-play-circle-outline'"
            :loading="sessionActionLoading"
            size="small"
            @click="toggleSession"
          >
            {{ roomsStore.currentSession ? t('sessions.close') : t('sessions.start') }}
          </v-btn>
          <v-btn
            variant="tonal"
            prepend-icon="mdi-book-clock-outline"
            size="small"
            @click="sessionHistoryOpen = true"
          >
            {{ t('sessions.recap.historyButton') }}
          </v-btn>
          <v-tooltip v-if="bonusPointsEnabled" location="bottom">
            <template #activator="{ props: tooltipProps }">
              <v-chip
                v-bind="tooltipProps"
                variant="tonal"
                color="primary"
                class="bonus-points-chip"
                prepend-icon="mdi-star-four-points"
              >
                {{ currentUserBonusPoints }}/{{ maxBonusPoints }}
              </v-chip>
            </template>
            <span>{{ t('bonusPoints.memberPoints', { current: currentUserBonusPoints, max: maxBonusPoints }) }}</span>
          </v-tooltip>
          <RoomMembersMenu
            :room="room"
            :bonus-point-balances="roomsStore.bonusPointBalances"
            :max-bonus-points="maxBonusPoints"
          />
          <v-btn
            icon="mdi-cog"
            variant="text"
            :disabled="!room || !currentUser"
            :title="t('chat.roomSettings')"
            @click="openSettingsPanel"
          />
          <v-btn
            icon="mdi-content-copy"
            variant="text"
            :disabled="!inviteLink"
            :title="t('chat.copyInviteLink')"
            @click="copyInviteLink"
          />
        </div>
      </v-card-title>
      </Transition>

      <v-divider />

      <v-card-text style="height: 90%;">
        <div
          ref="chatLayout"
          class="chat-layout"
          :class="{ 'is-resizing': isResizing }"
          :style="chatLayoutStyles"
        >
          <div class="chat-section">
            <v-infinite-scroll
              ref="messageContainerRef"
              class="messages-container"
              side="start"
              @load="handleInfiniteLoad"
              @scroll.passive="handleScroll"
            >
              <RoomMessagesList
                :messages="messages"
                :room-id="room.id"
                :current-user-id="currentUser?.id ?? null"
                :room-criticals="roomsStore.currentSession?.configuration.criticals ?? room?.criticals ?? []"
                :critical-animations-enabled="roomsStore.realtimeHydrated && !historyLoading"
                :can-use-bonus-point="canUseBonusPoints"
                :active-session-id="roomsStore.currentSession?.id ?? null"
                :allow-extreme-bonus-spend="roomsStore.currentSession?.configuration.bonusPoints.allowExtremeSpend ?? false"
                :bonus-point-rules="roomsStore.currentSession?.configuration.bonusPoints.rules ?? roomsStore.bonusPointRules"
                :bonus-point-action-loading-id="roomsStore.bonusPointRollUpdatingId"
                @use-bonus-point="useBonusPointOnRoll"
              />
            </v-infinite-scroll>

            <div class="chat-input mt-4">
              <v-text-field
                ref="messageInput"
                v-model="messageText"
                :label="t('chat.messageInput')"
                variant="outlined"
                density="comfortable"
                @keyup.enter="sendMessage"
                :disabled="sending"
              >
                <template #prepend-inner>
                  <v-btn
                    icon="mdi-help-circle-outline"
                    variant="text"
                    size="small"
                    :title="t('chat.dicePrefixHelpTitle')"
                    :aria-label="t('chat.dicePrefixHelpTitle')"
                    @click.stop="dicePrefixHelpDialog = true"
                  />
                </template>
                <template #append-inner>
                  <v-btn
                    icon="mdi-send"
                    variant="text"
                    :disabled="!messageText.trim()"
                    :loading="sending"
                    @click="sendMessage"
                  />
                </template>
              </v-text-field>
              <v-checkbox
                v-if="bonusPointsEnabled"
                v-model="skipBonusPointRules"
                :label="t('bonusPoints.skipRulesForRoll')"
                density="compact"
                hide-details
                class="mt-n2 mb-2"
                :disabled="sending"
              />
              <v-btn
                class="mobile-tools-toggle"
                variant="tonal"
                color="primary"
                prepend-icon="mdi-dice-multiple-outline"
                block
                @click="mobileToolsOpen = true"
              >
                {{ t('chat.roomToolsTitle') }}
              </v-btn>
            </div>
          </div>

          <div
            class="resize-handle"
            role="separator"
            aria-orientation="vertical"
            :aria-valuenow="Math.round(chatWidth)"
            aria-valuemin="30"
            aria-valuemax="80"
            @mousedown.prevent="startResize"
            @touchstart.prevent="startResize"
          >
            <span class="resize-grip" />
          </div>

          <div v-if="mdAndUp" class="dice-section">
            <v-card flat class="dice-panel-card" color="transparent">
              <v-tabs
                v-model="diceSidebarTab"
                density="comfortable"
                color="primary"
                class="mb-2"
              >
                <v-tab value="dices">{{ t('roomSettings.tabs.dices') }}</v-tab>
                <v-tab value="rollAwards">{{ t('roomSettings.tabs.rollAwards') }}</v-tab>
              </v-tabs>

              <v-window v-model="diceSidebarTab" class="dice-section-content">
                <v-window-item value="dices" class="dice-section-content-item">
                  <RoomDicePanel :current-user="currentUser" @manage-dice="openDiceSettings" />
                </v-window-item>
                <v-window-item value="rollAwards" class="dice-section-content-item">
                  <RoomRollAwardsPanel
                    :room="room"
                    :messages="messages"
                    :current-user="currentUser"
                  />
                </v-window-item>
              </v-window>
            </v-card>
          </div>
        </div>
      </v-card-text>
    </template>
    <template v-else>
      <v-card-text class="text-center py-12">
        <v-icon size="48" color="primary" class="mb-4">mdi-dice-5</v-icon>
        <div class="text-h6 mb-2">{{ t('chat.emptyTitle') }}</div>
        <p class="text-body-2 text-medium-emphasis">
          {{ t('chat.emptyDescription') }}
        </p>
      </v-card-text>
    </template>
  </v-card>
  <v-btn
    v-if="canUseRoomDevTools && room && currentUser && !devTestPanelOpen"
    class="room-dev-test-fab"
    icon="mdi-test-tube"
    color="warning"
    size="large"
    elevation="8"
    :title="t('roomDevTools.open')"
    :aria-label="t('roomDevTools.open')"
    @click="devTestPanelOpen = true"
  />
  <v-bottom-sheet
    v-if="!mdAndUp"
    v-model="mobileToolsOpen"
    content-class="mobile-tools-bottom-sheet"
  >
    <v-card class="mobile-tools-sheet" rounded="t-xl">
      <div class="bottom-sheet-grab-handle" aria-hidden="true" />
      <v-card-title class="d-flex align-center justify-space-between">
        <span>{{ t('chat.roomToolsTitle') }}</span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          :title="t('common.close')"
          :aria-label="t('common.close')"
          @click="closeMobileTools"
        />
      </v-card-title>
      <v-divider />
      <v-tabs
        v-model="diceSidebarTab"
        density="comfortable"
        color="primary"
        grow
        class="mobile-tools-tabs"
      >
        <v-tab value="dices">{{ t('roomSettings.tabs.dices') }}</v-tab>
        <v-tab value="rollAwards">{{ t('roomSettings.tabs.rollAwards') }}</v-tab>
      </v-tabs>
      <v-card-text class="mobile-tools-content">
        <v-window v-model="diceSidebarTab">
          <v-window-item value="dices">
            <RoomDicePanel :current-user="currentUser" @manage-dice="openDiceSettings" />
          </v-window-item>
          <v-window-item value="rollAwards">
            <RoomRollAwardsPanel
              :room="room"
              :messages="messages"
              :current-user="currentUser"
            />
          </v-window-item>
        </v-window>
      </v-card-text>
    </v-card>
  </v-bottom-sheet>
  <v-dialog v-model="dicePrefixHelpDialog" max-width="520">
    <v-card>
      <v-card-title class="d-flex align-center justify-space-between">
        <span>{{ t('chat.dicePrefixHelpTitle') }}</span>
        <v-btn
          icon="mdi-close"
          variant="text"
          size="small"
          :title="t('common.close')"
          :aria-label="t('common.close')"
          @click="dicePrefixHelpDialog = false"
        />
      </v-card-title>
      <v-divider />
      <v-card-text class="dice-prefix-help-content">
        <p>{{ t('chat.dicePrefixHelp') }}</p>
        <div>
          <strong>{{ t('chat.examples') }}</strong>
          <div>{{ t('chat.advantageExample') }}</div>
          <div>{{ t('chat.disadvantageExample') }}</div>
        </div>
      </v-card-text>
      <v-card-actions class="justify-end">
        <v-btn variant="text" @click="dicePrefixHelpDialog = false">
          {{ t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
  <RoomSettingsDialog
    v-model:open="settingsDialog"
    :room="room"
    :current-user="currentUser"
    :initial-tab="settingsPanelTab"
  />
  <RoomDevTestPanel
    v-if="canUseRoomDevTools"
    v-model:open="devTestPanelOpen"
    :members="roomsStore.members"
    :current-user-id="currentUser?.id ?? null"
    :sending="sending"
    :bonus-points-enabled="bonusPointsEnabled"
    @send-message="sendMessageAs"
    @send-dice="sendDiceAs"
  />
  <v-dialog v-model="recapDialogOpen" :fullscreen="smAndDown" max-width="760" scrollable>
    <v-card v-if="roomsStore.closedSessionForRecap">
      <v-card-title class="d-flex align-center justify-space-between">
        <span>{{ t('sessions.recap.title') }}</span>
        <v-btn icon="mdi-close" variant="text" @click="roomsStore.dismissSessionRecap()" />
      </v-card-title>
      <v-divider />
      <v-card-text><RoomSessionRecap :recap="roomsStore.closedSessionForRecap.recap" /></v-card-text>
      <v-card-actions class="justify-end"><v-btn variant="text" @click="roomsStore.dismissSessionRecap()">{{ t('common.close') }}</v-btn></v-card-actions>
    </v-card>
  </v-dialog>
  <RoomSessionHistoryDialog v-model="sessionHistoryOpen" :room-id="room?.id ?? null" />
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDisplay } from 'vuetify';
import type { RoomDetails, RoomMessage } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomDiceManagerKey, useRoomDiceManager } from 'core/composables/useRoomDiceManager';
import { RoomRollAwardsManagerKey, useRoomRollAwardsManager } from 'core/composables/useRoomRollAwardsManager';
import { appStorage } from 'core/services/app-storage.service';
import { type DiceRoll } from 'core/utils/dice.utils';
import { ROOM_MESSAGES_PAGE_SIZE, useRoomsStore } from 'core/stores/rooms.store';
import RoomMembersMenu from './RoomMembersMenu.component.vue';
import RoomMessagesList from './RoomMessagesList.component.vue';
import RoomDicePanel from './RoomDicePanel.component.vue';
import RoomRollAwardsPanel from './RoomRollAwardsPanel.component.vue';
import RoomSettingsDialog from './RoomSettingsDialog.component.vue';
import RoomSessionRecap from './RoomSessionRecap.component.vue';
import RoomSessionHistoryDialog from './RoomSessionHistoryDialog.component.vue';

const DEFAULT_CHAT_PERCENT = 65;
const MIN_CHAT_WIDTH = 320;
const MIN_DICE_WIDTH = 280;
const DESKTOP_BREAKPOINT = 960;
const nonPassiveTouchOptions: AddEventListenerOptions = { passive: false };
type SettingsTab = 'room' | 'dices' | 'rollAwards' | 'criticals' | 'bonusPoints';
const BOTTOM_SCROLL_THRESHOLD = 120;
type InfiniteScrollSide = 'start' | 'end' | 'both';
type InfiniteScrollStatus = 'ok' | 'empty' | 'loading' | 'error';
type InfiniteScrollDone = (status: InfiniteScrollStatus) => void;
type InfiniteScrollResettable = { reset?: (side?: InfiniteScrollSide) => void };
const isBrowser = typeof window !== 'undefined';
const isDev = import.meta.env.DEV;
const RoomDevTestPanel = isDev
  ? defineAsyncComponent(() => import('./RoomDevTestPanel.component.vue'))
  : null;

const props = defineProps<{
  room: RoomDetails | null;
  messages: RoomMessage[];
  sending: boolean;
  currentUser: DiscordUser | null;
  historyLoading: boolean;
  canLoadOlder: boolean;
}>();

const canUseRoomDevTools = computed(() => (
  isDev && (props.currentUser?.role === 'owner' || props.currentUser?.role === 'admin')
));

const { t } = useI18n();
const { mdAndUp, smAndDown } = useDisplay();
const roomsStore = useRoomsStore();
const realtimeIndicator = computed(() => {
  switch (roomsStore.realtimeStatus) {
    case 'connected':
      return { color: 'success', icon: 'mdi-access-point', label: t('chat.realtime.connected') };
    case 'connecting':
      return { color: 'info', icon: 'mdi-access-point', label: t('chat.realtime.connecting') };
    case 'reconnecting':
      return { color: 'warning', icon: 'mdi-access-point-network-off', label: t('chat.realtime.reconnecting') };
    default:
      return { color: 'error', icon: 'mdi-access-point-network-off', label: t('chat.realtime.disconnected') };
  }
});

const emit = defineEmits<{
  (event: 'send-message', message: string, skipBonusPointRules: boolean): void;
  (event: 'send-dice', roll: DiceRoll, skipBonusPointRules: boolean): void;
  (event: 'send-message-as', userId: string, message: string): void;
  (event: 'send-dice-as', userId: string, roll: DiceRoll, skipBonusPointRules: boolean): void;
  (event: 'use-bonus-point', message: RoomMessage): void;
  (event: 'load-older'): void;
  (event: 'trim-history'): void;
}>();

const messageText = ref('');
const skipBonusPointRules = ref(false);
const messageInput = ref<{ focus: () => void } | null>(null);
const chatLayout = ref<HTMLElement | null>(null);
const chatWidth = ref(loadInitialWidth());
const isResizing = ref(false);
const layoutBounds = ref<{ left: number; width: number } | null>(null);
const settingsDialog = ref(false);
const dicePrefixHelpDialog = ref(false);
const mobileToolsOpen = ref(false);
const devTestPanelOpen = ref(false);
const settingsPanelTab = ref<SettingsTab>('room');
const diceSidebarTab = ref<'dices' | 'rollAwards'>('dices');
const showSessionBanner = ref(false);
const sessionActionLoading = ref(false);
const sessionHistoryOpen = ref(false);
const timerNow = ref(Date.now());
const pendingLoadDone = ref<InfiniteScrollDone | null>(null);
const loadingOlder = ref(false);
const hasLoadedOlder = ref(false);
let resizeRaf: number | null = null;
let pendingClientX: number | null = null;
let sessionBannerTimer: number | null = null;
let sessionClockTimer: number | null = null;

const isRoomCreator = computed(() => Boolean(props.room && props.currentUser && props.room.createdBy === props.currentUser.id));
const sessionDuration = computed(() => {
  const startedAt = roomsStore.currentSession?.startedAt;
  if (!startedAt) return '00:00:00';
  const seconds = Math.max(0, Math.floor((timerNow.value - new Date(startedAt).getTime()) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return [hours, minutes, remaining].map((value) => String(value).padStart(2, '0')).join(':');
});
const recapDialogOpen = computed({
  get: () => Boolean(roomsStore.closedSessionForRecap),
  set: (value: boolean) => { if (!value) roomsStore.dismissSessionRecap(); },
});

const inviteLink = computed(() => {
  if (!props.room || !isBrowser) return '';
  return `${window.location.origin}/rooms/${props.room.id}?invite=${props.room.inviteCode}`;
});

const messageContainerRef = ref<ComponentPublicInstance | null>(null);
const messageContainer = computed<HTMLElement | null>(
  () => (messageContainerRef.value?.$el as HTMLElement | null) ?? null
);

const showInviteCode = ref(false);
const maskedInviteCode = computed(() => {
  const code = props.room?.inviteCode ?? '';
  return code ? '*'.repeat(code.length) : '';
});
const displayedInviteCode = computed(() => {
  if (!props.room) return '';
  return showInviteCode.value ? props.room.inviteCode : maskedInviteCode.value;
});

const maxBonusPoints = computed(() => roomsStore.currentSession?.configuration.bonusPoints.maxPointsPerUser ?? roomsStore.bonusPointSettings?.maxPointsPerUser ?? props.room?.bonusPointSettings?.maxPointsPerUser ?? 0);
const currentUserBonusPoints = computed(() => {
  if (!props.currentUser) return 0;
  return roomsStore.bonusPointBalances.find((balance) => balance.userId === props.currentUser?.id)?.points ?? 0;
});
const bonusPointsEnabled = computed(() => Boolean(roomsStore.currentSession?.configuration.bonusPoints.enabled ?? roomsStore.bonusPointSettings?.enabled ?? props.room?.bonusPointSettings?.enabled));
const canUseBonusPoints = computed(() => (
  Boolean(roomsStore.currentSession) &&
  bonusPointsEnabled.value &&
  currentUserBonusPoints.value > 0 &&
  (roomsStore.currentSession?.configuration.bonusPoints.rules.length ?? roomsStore.bonusPointRules.length) > 0
));
const chatLayoutStyles = computed(() => ({
  '--chat-panel-width': `${chatWidth.value}%`,
  '--dice-panel-width': `${Math.max(0, 100 - chatWidth.value)}%`,
}));

const diceManager = useRoomDiceManager(
  () => props.room,
  () => props.currentUser,
  (roll) => {
    emit('send-dice', roll, skipBonusPointRules.value);
    skipBonusPointRules.value = false;
    focusMessageInput();
  }
);

provide(RoomDiceManagerKey, diceManager);

const rollAwardsManager = useRoomRollAwardsManager(
  () => props.room,
  () => props.currentUser
);

provide(RoomRollAwardsManagerKey, rollAwardsManager);

let hasMounted = false;

function finishPendingLoad(status: InfiniteScrollStatus = 'ok') {
  pendingLoadDone.value?.(status);
  pendingLoadDone.value = null;
}

function resetRoomState() {
  messageText.value = '';
  skipBonusPointRules.value = false;
  finishPendingLoad('ok');
  loadingOlder.value = false;
  hasLoadedOlder.value = false;
  resetInfiniteScroll();
  showInviteCode.value = false;
  dicePrefixHelpDialog.value = false;
  mobileToolsOpen.value = false;
  devTestPanelOpen.value = false;
  if (!props.room) {
    settingsDialog.value = false;
    return;
  }
  void roomsStore.loadBonusPoints(props.room.id, true);
  focusMessageInput();
}

watch(
  () => props.room?.id,
  resetRoomState,
  { immediate: true }
);

watch(
  () => props.messages.length,
  (length, previousLength) => {
    const added = previousLength !== undefined && length > previousLength;
    if (added && !props.historyLoading && !loadingOlder.value && !hasLoadedOlder.value) {
      nextTick(scrollToBottom);
    }
  }
);

watch(
  () => props.historyLoading,
  (loading, wasLoading) => {
    if (!loading && wasLoading) {
      finishPendingLoad(props.canLoadOlder ? 'ok' : 'empty');
      loadingOlder.value = false;
      if (hasMounted) {
        hasLoadedOlder.value = true;
      }
    }
  }
);

watch(
  () => props.sending,
  (isSending, wasSending) => {
    if (!isSending && wasSending) {
      focusMessageInput();
    }
  }
);

function loadInitialWidth() {
  if (!isBrowser) return DEFAULT_CHAT_PERCENT;
  const value = appStorage.getChatWidthPercent();
  if (value !== null && Number.isFinite(value) && value >= 30 && value <= 80) {
    return value;
  }
  return DEFAULT_CHAT_PERCENT;
}

function requestOlderMessagesWithDone(done?: InfiniteScrollDone) {
  if (!props.canLoadOlder) {
    done?.('empty');
    return;
  }
  if (props.historyLoading || pendingLoadDone.value) {
    done?.('loading');
    return;
  }
  pendingLoadDone.value = done ?? null;
  loadingOlder.value = true;
  emit('load-older');
}

function handleInfiniteLoad({
  side,
  done,
}: {
  side: InfiniteScrollSide;
  done: InfiniteScrollDone;
}) {
  if (side === 'start') {
    requestOlderMessagesWithDone(done);
    return;
  }
  done('ok');
}

function resetInfiniteScroll() {
  (messageContainerRef.value as InfiniteScrollResettable | null)?.reset?.('start');
  hasLoadedOlder.value = false;
}

function scrollToBottom() {
  const container = messageContainer.value;
  if (!container) return;
  container.scrollTop = container.scrollHeight;
}

function handleScroll() {
  const container = messageContainer.value;
  if (!container) return;
  const { scrollTop, scrollHeight, clientHeight } = container;
  const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
  const nearBottom = distanceFromBottom < BOTTOM_SCROLL_THRESHOLD;
  if (nearBottom && props.messages.length > ROOM_MESSAGES_PAGE_SIZE) {
    emit('trim-history');
    resetInfiniteScroll();
  }
}

function sendMessage() {
  if (!messageText.value.trim()) return;
  emit('send-message', messageText.value, skipBonusPointRules.value);
  messageText.value = '';
  skipBonusPointRules.value = false;
  focusMessageInput();
}

function sendMessageAs(userId: string, content: string) {
  if (!canUseRoomDevTools.value) return;
  emit('send-message-as', userId, content);
}

function sendDiceAs(userId: string, roll: DiceRoll, skipRules: boolean) {
  if (!canUseRoomDevTools.value) return;
  emit('send-dice-as', userId, roll, skipRules);
}

function useBonusPointOnRoll(message: RoomMessage) {
  emit('use-bonus-point', message);
}

async function copyInviteLink() {
  if (!inviteLink.value) return;
  try {
    await navigator.clipboard.writeText(inviteLink.value);
  } catch (error) {
    console.error(t('chat.copyInviteLinkError'), error);
  }
}

function toggleInviteVisibility() {
  if (!props.room?.inviteCode) return;
  showInviteCode.value = !showInviteCode.value;
}

function openSettingsPanel(tab: SettingsTab = 'room') {
  if (!props.room || !props.currentUser) return;
  mobileToolsOpen.value = false;
  settingsPanelTab.value = tab;
  settingsDialog.value = true;
}

function openDiceSettings() {
  openSettingsPanel('dices');
}

function closeMobileTools() {
  mobileToolsOpen.value = false;
  focusMessageInput();
}

function persistChatWidth(value: number) {
  if (!isBrowser) return;
  appStorage.setChatWidthPercent(value);
}

function startResize(event: MouseEvent | TouchEvent) {
  if (!isDesktop() || !chatLayout.value) return;
  const bounds = chatLayout.value.getBoundingClientRect();
  if (bounds.width <= MIN_CHAT_WIDTH + MIN_DICE_WIDTH) return;
  isResizing.value = true;
  layoutBounds.value = { left: bounds.left, width: bounds.width };
  scheduleWidthUpdate(getClientX(event));
}

function handlePointerMove(event: MouseEvent | TouchEvent) {
  if (!isResizing.value) return;
  event.preventDefault();
  scheduleWidthUpdate(getClientX(event));
}

function stopResize() {
  if (!isResizing.value) return;
  isResizing.value = false;
  layoutBounds.value = null;
  pendingClientX = null;
  if (resizeRaf !== null) {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = null;
  }
  persistChatWidth(chatWidth.value);
}

function getClientX(event: MouseEvent | TouchEvent) {
  if ('touches' in event) {
    const touch = event.touches[0];
    return touch ? touch.clientX : null;
  }
  return event.clientX;
}

function updateChatWidth(clientX: number | null) {
  if (clientX === null) return;
  const bounds = layoutBounds.value ?? chatLayout.value?.getBoundingClientRect();
  if (!bounds || bounds.width <= 0) return;

  const position = clientX - bounds.left;
  const maxChatWidth = bounds.width - MIN_DICE_WIDTH;
  const minChatWidth = Math.min(Math.max(MIN_CHAT_WIDTH, 0), maxChatWidth);
  const constrained = clamp(position, minChatWidth, maxChatWidth);
  const percent = (constrained / bounds.width) * 100;
  chatWidth.value = clamp(percent, 30, 80);
}

function scheduleWidthUpdate(clientX: number | null) {
  pendingClientX = clientX;
  if (resizeRaf !== null) return;
  resizeRaf = window.requestAnimationFrame(() => {
    resizeRaf = null;
    updateChatWidth(pendingClientX);
  });
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isDesktop() {
  if (!isBrowser) return false;
  return window.innerWidth >= DESKTOP_BREAKPOINT;
}

function handleWindowResize() {
  if (!chatLayout.value) return;
  if (!isDesktop()) {
    stopResize();
    return;
  }
  layoutBounds.value = chatLayout.value.getBoundingClientRect();
  const bounds = layoutBounds.value;
  if (!bounds) return;
  const clientX = bounds.left + (chatWidth.value / 100) * bounds.width;
  updateChatWidth(clientX);
}

function focusMessageInput() {
  if (!props.room || !hasMounted) return;
  nextTick(() => {
    messageInput.value?.focus();
  });
}

watch(() => roomsStore.sessionStartSignal, () => {
  showSessionBanner.value = true;
  if (sessionBannerTimer !== null) window.clearTimeout(sessionBannerTimer);
  sessionBannerTimer = window.setTimeout(() => { showSessionBanner.value = false; }, 4_000);
});

async function toggleSession() {
  if (!props.room || !props.currentUser || sessionActionLoading.value) return;
  sessionActionLoading.value = true;
  try {
    if (roomsStore.currentSession) {
      await roomsStore.closeSession({ roomId: props.room.id, userId: props.currentUser.id });
    } else {
      await roomsStore.startSession({ roomId: props.room.id, userId: props.currentUser.id });
    }
  } catch (error) {
    roomsStore.setError(error instanceof Error ? error.message : String(error));
  } finally {
    sessionActionLoading.value = false;
  }
}

onMounted(() => {
  hasMounted = true;
  window.addEventListener('mousemove', handlePointerMove);
  window.addEventListener('mouseup', stopResize);
  window.addEventListener('touchmove', handlePointerMove, nonPassiveTouchOptions);
  window.addEventListener('touchend', stopResize);
  window.addEventListener('resize', handleWindowResize);
  focusMessageInput();
  sessionClockTimer = window.setInterval(() => { timerNow.value = Date.now(); }, 1_000);
});

onUnmounted(() => {
  hasMounted = false;
  window.removeEventListener('mousemove', handlePointerMove);
  window.removeEventListener('mouseup', stopResize);
  window.removeEventListener('touchmove', handlePointerMove, nonPassiveTouchOptions);
  window.removeEventListener('touchend', stopResize);
  window.removeEventListener('resize', handleWindowResize);
  if (sessionClockTimer !== null) window.clearInterval(sessionClockTimer);
  if (sessionBannerTimer !== null) window.clearTimeout(sessionBannerTimer);
});
</script>

<style scoped>
.room-chat-panel {
  min-height: 600px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.session-start-banner {
  min-height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: rgb(var(--v-theme-on-accent));
  background-color: rgb(var(--v-theme-accent));
}

.session-timer {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}

.session-header-enter-active,
.session-header-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.session-header-enter-from { opacity: 0; transform: translateY(-10px); }
.session-header-leave-to { opacity: 0; transform: translateY(10px); }

.room-dev-test-fab {
  position: fixed;
  right: max(20px, env(safe-area-inset-right));
  bottom: max(20px, env(safe-area-inset-bottom));
  z-index: 1005;
}

.messages-container {
  overflow-y: auto;
  padding-right: 8px;
  height: 100%;
}

.dice-prefix-help-content {
  display: grid;
  gap: 16px;
}

.chat-layout {
  --chat-panel-width: 65%;
  --dice-panel-width: 35%;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow: hidden;
  height: 100%;
}

.chat-layout.is-resizing {
  cursor: col-resize;
}

.chat-layout.is-resizing * {
  user-select: none;
}

.chat-section {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.dice-section {
  height: 100%;
}

.chat-section,
.dice-section {
  min-width: 0;
  width: 100%;
}

.dice-section :deep(.dice-panel),
.dice-section :deep(.v-card) {
  width: 100%;
  box-sizing: border-box;
}

.dice-panel-card {
  width: 100%;
  height: 100%;
  background-color: transparent;
  display: flex;
  flex-direction: column;
}

.mobile-tools-toggle {
  display: none;
}

.mobile-tools-sheet {
  display: flex;
  flex-direction: column;
  height: min(85dvh, 760px);
  overflow: hidden;
}

.bottom-sheet-grab-handle {
  width: 40px;
  height: 4px;
  flex: 0 0 auto;
  margin: 8px auto 0;
  border-radius: 999px;
  background: rgb(var(--v-theme-on-surface), 0.3);
}

.mobile-tools-sheet > .v-card-title,
.mobile-tools-tabs {
  flex: 0 0 auto;
}

.mobile-tools-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
}

.resize-handle {
  display: none;
  width: 12px;
  align-self: stretch;
  align-items: center;
  justify-content: center;
  cursor: col-resize;
  background-color: rgba(var(--v-theme-on-surface), 0.12);
  border-radius: 4px;
}

.resize-grip {
  width: 4px;
  height: 48px;
  border-radius: 999px;
  background-color: rgba(var(--v-theme-on-surface), 0.42);
  transition: background-color 0.2s ease;
}

.resize-handle:hover .resize-grip,
.chat-layout.is-resizing .resize-grip {
  background-color: rgba(var(--v-theme-on-surface), 0.56);
}

.dice-section-content {
  height: 100%;
}

.dice-section-content-item {
  height: 100%;
}

@media (min-width: 960px) {
  .chat-layout {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: stretch;
    gap: 16px;
  }

  .chat-section {
    flex: 1 1 var(--chat-panel-width);
    min-width: 0;
  }

  .dice-section {
    flex: 0 1 var(--dice-panel-width);
    min-width: 240px;
  }

  .resize-handle {
    display: flex;
    flex: 0 0 12px;
  }
}

@media (max-width: 959px) {
  .chat-layout {
    gap: 0;
  }

  .chat-section {
    height: 100%;
  }

  .dice-section {
    display: none;
  }

  .mobile-tools-toggle {
    display: flex;
  }
}
</style>
