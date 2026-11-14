<template>
  <RoomSessionStartDialog :is-leader="roomAccess.rights.assignRollAwards" />
  <div class="room-panel-host">
  <v-card class="room-chat-panel" :inert="settingsDialog || bagOpen || toolsPanel !== null">
    <template v-if="room">
      <Transition name="session-header" mode="out-in">
      <v-card-title v-if="showSessionBanner" key="session-banner" class="session-start-banner">
        <v-icon icon="mdi-timer-play-outline" />
        <span>{{ t('sessions.startedBanner') }}</span>
      </v-card-title>
      <v-card-title v-else key="room-header" class="room-header">
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
        <div class="room-header-actions">
          <span v-if="roomsStore.currentSession" class="session-timer" aria-live="off">{{ sessionDuration }}</span>
          <v-btn
            v-if="isRoomCreator"
            :color="roomsStore.currentSession ? 'error' : 'primary'"
            variant="tonal"
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
                size="small"
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
          <v-btn v-if="room.bagEnabled && roomAccess.rights.viewBag" class="room-header-bag" color="amber-darken-2" variant="tonal" size="small" :title="t('bag.title')" :aria-label="t('bag.title')" @click="bagOpen = true">
            <v-icon icon="mdi-bag-personal" /><span class="d-none d-sm-inline ml-2">{{ t('bag.title') }}</span>
          </v-btn>
          <v-btn
            icon="mdi-cog"
            data-room-panel-trigger
            class="room-header-utility"
            variant="text"
            :disabled="!room || !currentUser"
            :title="t('chat.roomSettings')"
            :aria-label="t('chat.roomSettings')"
            @click="openSettingsPanel()"
          />
          <v-btn
            icon="mdi-content-copy"
            class="room-header-utility"
            variant="text"
            :disabled="!inviteLink"
            :title="t('chat.copyInviteLink')"
            :aria-label="t('chat.copyInviteLink')"
            @click="copyInviteLink"
          />
        </div>
      </v-card-title>
      </Transition>

      <v-divider />

      <v-card-text style="height: 90%;">
        <div class="chat-layout">
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
                :bonus-configuration="roomsStore.currentSession?.configuration.bonusPoints"
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
            </div>
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
  <nav v-if="room && currentUser" v-show="!settingsDialog && !bagOpen" class="room-tools-rail" :aria-label="t('chat.roomToolsTitle')">
    <v-btn class="room-tool-button" variant="tonal" :color="toolsPanel === 'dices' ? 'primary' : undefined" :aria-label="t('roomSettings.tabs.dices')" :aria-expanded="toolsPanel === 'dices'" aria-controls="room-tools-panel" @click="toggleTools('dices')">
      <v-icon icon="mdi-dice-multiple-outline" />
      <span class="room-tool-label" aria-hidden="true">{{ t('roomSettings.tabs.dices') }}</span>
    </v-btn>
    <v-btn v-if="roomAccess.rights.viewRollAwards" class="room-tool-button" variant="tonal" :color="toolsPanel === 'rollAwards' ? 'primary' : undefined" :aria-label="t('rollAwards.title')" :aria-expanded="toolsPanel === 'rollAwards'" aria-controls="room-tools-panel" @click="toggleTools('rollAwards')">
      <v-icon icon="mdi-trophy-outline" />
      <span class="room-tool-label" aria-hidden="true">{{ t('rollAwards.title') }}</span>
    </v-btn>
    <v-btn v-if="canUseRoomDevTools" class="room-tool-button" variant="flat" color="warning" :aria-label="t('roomDevTools.open')" :aria-expanded="toolsPanel === 'devTools'" aria-controls="room-tools-panel" @click="toggleTools('devTools')">
      <v-icon icon="mdi-test-tube" />
      <span class="room-tool-label" aria-hidden="true">{{ t('roomDevTools.title') }}</span>
    </v-btn>
  </nav>
  <RoomSlidePanel backdrop id="room-tools-panel" :model-value="toolsPanel !== null" :label="t(toolPresentation[toolsTab].title)" width="468px" class="room-tools-panel" @update:model-value="toolsPanel = null">
    <v-card>
      <v-card-title class="tools-heading">
        <v-icon :icon="toolPresentation[toolsTab].icon" :color="toolsTab === 'devTools' ? 'warning' : 'primary'" />
        <h2 class="text-h6">{{ t(toolPresentation[toolsTab].title) }}</h2>
        <v-btn icon="mdi-close" variant="text" :aria-label="t('common.close')" @click="toolsPanel = null" />
      </v-card-title>
      <v-divider />
      <div class="tools-body">
        <RoomDicePanel v-show="toolsTab === 'dices'" :current-user="currentUser" @manage-dice="openDiceSettings" @open-editor="openDiceEditor" />
        <RoomRollAwardsPanel v-if="roomAccess.rights.viewRollAwards" v-show="toolsTab === 'rollAwards'" :room="room" :current-user="currentUser" :active="toolsPanel === 'rollAwards'" />
        <RoomDevTestPanel
          v-if="canUseRoomDevTools"
          v-show="toolsTab === 'devTools'"
          :key="`${room?.id}:${currentUser?.id}`"
          :members="roomsStore.members"
          :current-user-id="currentUser?.id ?? null"
          :sending="sending"
          :bonus-points-enabled="bonusPointsEnabled"
          @send-message="sendMessageAs"
          @send-dice="sendDiceAs"
        />
      </div>
    </v-card>
  </RoomSlidePanel>
  <RoomBagDialog v-if="room?.bagEnabled && roomAccess.rights.viewBag && currentUser" v-model="bagOpen" :key="room.id + currentUser.id" :room-id="room.id" :user-id="currentUser.id" />
  <RoomSettingsDialog
    v-model:open="settingsDialog"
    :room="room"
    :current-user="currentUser"
    :initial-tab="settingsPanelTab"
    @open-dice-editor="openDiceEditor"
  />
  <RoomDiceManagementDialog :settings-open="settingsDialog" v-model="diceEditor" :room="room" :current-user="currentUser" />
  </div>


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
import { useRoomAccess } from 'core/composables/useRoomAccess';
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { useDisplay } from 'vuetify';
import type { RoomDetails, RoomDice, RoomMessage } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomDiceManagerKey, useRoomDiceManager } from 'core/composables/useRoomDiceManager';
import { RoomRollAwardsManagerKey, useRoomRollAwardsManager } from 'core/composables/useRoomRollAwardsManager';
import { type DiceRoll } from 'core/utils/dice.utils';
import { ROOM_MESSAGES_PAGE_SIZE, useRoomsStore } from 'core/stores/rooms.store';
import RoomMembersMenu from './RoomMembersMenu.component.vue';
import RoomMessagesList from './RoomMessagesList.component.vue';
import RoomDicePanel from './RoomDicePanel.component.vue';
import RoomSlidePanel from './RoomSlidePanel.component.vue';
import RoomDiceManagementDialog from './RoomDiceManagementDialog.component.vue';
import RoomSessionStartDialog from './RoomSessionStartDialog.component.vue';
import RoomRollAwardsPanel from './RoomRollAwardsPanel.component.vue';
import RoomBagDialog from './RoomBagDialog.component.vue';
import RoomSettingsDialog from './RoomSettingsDialog.component.vue';
import RoomSessionRecap from './RoomSessionRecap.component.vue';
import RoomSessionHistoryDialog from './RoomSessionHistoryDialog.component.vue';

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
const { smAndDown } = useDisplay();
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
const bagOpen = ref(false);
const settingsDialog = ref(false);
const dicePrefixHelpDialog = ref(false);
type RoomTool = 'dices' | 'rollAwards' | 'devTools';
const toolPresentation = {
  dices: { title: 'roomSettings.tabs.dices', icon: 'mdi-dice-multiple-outline' },
  rollAwards: { title: 'rollAwards.title', icon: 'mdi-trophy-outline' },
  devTools: { title: 'roomDevTools.title', icon: 'mdi-test-tube' },
};
const toolsPanel = ref<RoomTool | null>(null);
const toolsTab = ref<RoomTool>('dices');
watch(toolsPanel, panel => { if (panel) toolsTab.value = panel; }, { flush: 'sync' });
const diceEditor = ref<'custom' | 'edit' | 'categories' | null>(null);
const settingsPanelTab = ref<SettingsTab>('room');
const showSessionBanner = ref(false);
const sessionActionLoading = ref(false);
const sessionHistoryOpen = ref(false);
const timerNow = ref(Date.now());
const pendingLoadDone = ref<InfiniteScrollDone | null>(null);
const loadingOlder = ref(false);
const hasLoadedOlder = ref(false);
let sessionBannerTimer: number | null = null;
let sessionClockTimer: number | null = null;

const roomAccess = useRoomAccess(computed(() => props.currentUser?.id));
const isRoomCreator = computed(() => roomAccess.value.rights.manageSessions);
watch(() => [props.room?.id, props.currentUser?.id, props.room?.bagEnabled, roomAccess.value.rights.viewBag] as const, (current, previous) => {
  if (!current[2] || !current[3] || current[0] !== previous[0] || current[1] !== previous[1]) bagOpen.value = false;
});
watch(canUseRoomDevTools, allowed => { if (!allowed && toolsPanel.value === 'devTools') toolsPanel.value = null; });
watch(roomAccess, access => { if (!access.rights.viewRollAwards && toolsPanel.value === 'rollAwards') toolsPanel.value = null; });
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
watch(settingsDialog, value => { if (value) { bagOpen.value = false; toolsPanel.value = null; } });
watch(bagOpen, value => { if (value) { settingsDialog.value = false; toolsPanel.value = null; } });
watch([() => props.room?.id, () => props.currentUser?.id], () => { settingsDialog.value = false; bagOpen.value = false; toolsPanel.value = null; diceEditor.value = null; });
const canUseBonusPoints = computed(() => (
  Boolean(roomsStore.currentSession) &&
  bonusPointsEnabled.value &&
  currentUserBonusPoints.value > 0 &&
  (roomsStore.currentSession?.configuration.bonusPoints.version === 2 ? (roomsStore.currentSession.configuration.bonusPoints.effects?.length ?? 0) : (roomsStore.currentSession?.configuration.bonusPoints.rules.length ?? roomsStore.bonusPointRules.length)) > 0
));
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
  toolsPanel.value = null;
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

watch(() => roomsStore.restoredDraft, (draft) => {
  if (!draft) return;
  messageText.value = [messageText.value, draft].filter(Boolean).join('\n');
  roomsStore.restoredDraft = '';
  focusMessageInput();
});

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
  toolsPanel.value = null;
  settingsPanelTab.value = tab;
  settingsDialog.value = true;
}

function openDiceSettings() {
  openSettingsPanel('dices');
}

function toggleTools(panel: RoomTool) {
  toolsPanel.value = toolsPanel.value === panel ? null : panel;
}
function openDiceEditor(mode: 'custom' | 'edit' | 'categories', dice?: RoomDice) {
  if (diceEditor.value || (mode === 'categories' ? !roomAccess.value.rights.manageDiceCategories : !roomAccess.value.rights.manageDice)) return;
  if (mode === 'edit') {
    if (!dice) return;
    diceManager.startEditingDice(dice);
  }
  diceEditor.value = mode;
}

function focusMessageInput() {
  if (!props.room || !hasMounted || toolsPanel.value || settingsDialog.value || bagOpen.value) return;
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
  focusMessageInput();
  sessionClockTimer = window.setInterval(() => { timerNow.value = Date.now(); }, 1_000);
});

onUnmounted(() => {
  hasMounted = false;
  if (sessionClockTimer !== null) window.clearInterval(sessionClockTimer);
  if (sessionBannerTimer !== null) window.clearTimeout(sessionBannerTimer);
});
</script>

<style scoped>
.room-panel-host { position: relative; height: 100%; min-height: 600px; overflow: hidden; border-radius: 4px; }
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

.room-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
.room-header > :first-child { min-width: 0; }
.room-header-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; max-width: 100%; margin-inline-start: auto; }
.room-header-actions :deep(.v-btn:not(.room-header-utility)),
.room-header-actions :deep(.v-chip) { height: 32px; min-height: 32px; border-radius: 4px; font-size: 12px; font-weight: 600; letter-spacing: .025em; }
.room-header-actions :deep(.v-btn:not(.v-btn--icon)) { padding-inline: 12px; }
.room-header-actions :deep(.v-btn--icon:not(.room-header-utility)) { width: 32px; min-width: 32px; padding: 0; }
.room-header-actions :deep(.v-chip) { padding-inline: 10px; }
.room-header-actions :deep(.v-btn:not(.room-header-utility) .v-icon),
.room-header-actions :deep(.v-chip .v-icon) { font-size: 18px; width: 18px; height: 18px; }
@media (max-width: 599px) {
  .room-header-actions { width: 100%; justify-content: flex-start; margin-inline-start: 0; }
  .room-header-actions .room-header-bag { width: 32px; min-width: 32px; padding: 0; }
}

.session-timer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding-inline: 10px;
  border-radius: 4px;
  background: rgba(var(--v-theme-on-surface), .04);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  white-space: nowrap;
}

.session-header-enter-active,
.session-header-leave-active { transition: opacity 180ms ease, transform 180ms ease; }
.session-header-enter-from { opacity: 0; transform: translateY(-10px); }
.session-header-leave-to { opacity: 0; transform: translateY(10px); }


.messages-container {
  overflow-y: auto;
  padding-right: 8px;
  height: 100%;
}

.dice-prefix-help-content {
  display: grid;
  gap: 16px;
}

.chat-layout { display: flex; height: 100%; min-height: 0; overflow: hidden; }
.chat-section { display: flex; flex-direction: column; height: 100%; min-width: 0; width: 100%; padding-right: 48px; }
.room-tools-rail { position: absolute; right: 4px; top: 112px; z-index: 1102; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.room-tools-rail .room-tool-button { min-width: 40px; height: 44px; padding-inline: 8px; border-radius: 10px 0 0 10px; background: rgb(var(--v-theme-surface)); }
.room-tool-button :deep(.v-btn__content) { display: flex; }
.room-tool-label { display: inline-block; max-width: 0; margin-inline-start: 0; overflow: hidden; white-space: nowrap; opacity: 0; transform: translateX(-8px); transition: max-width 220ms ease, margin-inline-start 220ms ease, opacity 180ms ease, transform 220ms ease; }
.room-tool-button:is(:hover, :focus-visible) .room-tool-label { max-width: 240px; margin-inline-start: 8px; opacity: 1; transform: translateX(0); }
@media (prefers-reduced-motion: reduce) { .room-tool-label { transition: none; } }
.room-panel-host :deep(.room-tools-panel) { padding-right: 48px; box-shadow: -8px 0 32px rgba(0, 0, 0, .16); }
.tools-heading { display: flex; align-items: center; gap: 8px; padding: 18px 12px; background: linear-gradient(120deg, rgba(var(--v-theme-primary), .12), transparent); }
.tools-heading h2 { flex: 1; }
.tools-body { display: flex; flex: 1; min-height: 0; overflow: hidden; }
@media (max-width: 599px) { .room-panel-host :deep(.room-tools-panel) { width: 100% !important; } .tools-heading { gap: 4px; } .tools-heading .v-btn { width: 32px; height: 36px; } }
</style>
