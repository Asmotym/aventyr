<template>
  <RoomSessionStartDialog :is-leader="roomAccess.rights.assignRollAwards" />
  <div class="room-panel-host">
  <v-card class="room-chat-panel" :elevation="0" :inert="settingsDialog || bagOpen || toolsPanel !== null || sessionHistoryOpen">
    <template v-if="room">
      <div class="room-header-shell">
      <v-card-title class="room-header" :class="{ 'room-header--celebrating': showSessionBanner }" :inert="showSessionBanner" :aria-hidden="showSessionBanner">
        <div class="room-identity">
          <span class="room-identity__emblem"><v-icon icon="mdi-dice-d20-outline" size="30" /></span>
          <div class="room-identity__copy">
          <div class="room-title-row">
            <h1 class="room-title">{{ room.name }}</h1>
            <v-chip
              size="x-small"
              variant="tonal"
              :color="realtimeIndicator.color"
              :prepend-icon="realtimeIndicator.icon"
            >
              {{ realtimeIndicator.label }}
            </v-chip>
          </div>
          <div class="room-invite">
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
            <v-btn
              variant="text"
              size="x-small"
              icon="mdi-content-copy"
              :disabled="!inviteLink"
              :title="t('chat.copyInviteLink')"
              :aria-label="t('chat.copyInviteLink')"
              @click="copyInviteLink"
            />
          </div>
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

          <RoomMembersMenu
            :room="room"
            :bonus-point-balances="roomsStore.bonusPointBalances"
            :max-bonus-points="maxBonusPoints"
          />
        </div>
      </v-card-title>
      <Transition name="session-header">
        <div v-if="showSessionBanner" class="session-start-banner" role="status" aria-live="polite"><span class="session-start-banner__icon"><v-icon icon="mdi-timer-play-outline" size="28" /></span><span>{{ t('sessions.startedBanner') }}</span></div>
      </Transition>
      </div>

      <v-divider />

      <v-card-text class="room-chat-body">
        <div class="chat-layout">
          <div class="chat-section">
            <v-infinite-scroll
              ref="messageContainerRef"
              class="messages-container"
              side="start"
              @load="handleInfiniteLoad"
              @scroll.passive="handleScroll"
            >
              <div v-if="!messages.length && !historyLoading && roomsStore.realtimeHydrated" class="conversation-empty"><span><v-icon icon="mdi-campfire" size="38" /></span><h2>{{ t('chat.design.emptyTitle') }}</h2><p>{{ t('chat.design.emptyDescription') }}</p></div>
              <RoomMessagesList
                :messages="messages"
                :room-id="room.id"
                :current-user-id="currentUser?.id ?? null"
                :room-criticals="roomsStore.currentSession?.configuration.criticals ?? room?.criticals ?? []"
                :critical-animations-enabled="roomsStore.realtimeHydrated && !historyLoading"
                :message-animations-enabled="roomsStore.realtimeHydrated && !historyLoading"
                :can-use-bonus-point="canUseBonusPoints"
                :active-session-id="roomsStore.currentSession?.id ?? null"
                :allow-extreme-bonus-spend="roomsStore.currentSession?.configuration.bonusPoints.allowExtremeSpend ?? false"
                :bonus-point-rules="roomsStore.currentSession?.configuration.bonusPoints.rules ?? roomsStore.bonusPointRules"
                :bonus-configuration="roomsStore.currentSession?.configuration.bonusPoints"
                :bonus-point-action-loading-id="roomsStore.bonusPointRollUpdatingId"
                @use-bonus-point="useBonusPointOnRoll"
              />
            </v-infinite-scroll>

            <div class="chat-input">
              <v-text-field
                ref="messageInput"
                v-model="messageText"
                :label="t('chat.messageInput')"
                variant="outlined"
                density="comfortable"
                hide-details="auto"
                role="combobox"
                aria-autocomplete="list"
                :aria-expanded="showDiceSuggestions"
                :aria-controls="showDiceSuggestions ? 'room-dice-suggestions' : undefined"
                :aria-activedescendant="showDiceSuggestions && selectedDiceSuggestion >= 0 ? `room-dice-suggestion-${selectedDiceSuggestion}` : undefined"
                @focus="composerFocused = true"
                @blur="composerFocused = false"
                @keydown="handleComposerKeydown"
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
                    variant="flat"
                    color="primary"
                    class="composer-send"
                    :aria-label="t('chat.design.send')"
                    :disabled="!messageText.trim()"
                    :loading="sending"
                    @click="sendMessage"
                  />
                </template>
              </v-text-field>
              <div v-if="showDiceSuggestions" id="room-dice-suggestions" class="dice-suggestions" role="listbox" :aria-label="t('chat.dicePrefixHelpTitle')">
                <button
                  v-for="(suggestion, index) in diceSuggestions"
                  :id="`room-dice-suggestion-${index}`"
                  :key="suggestion.prefix"
                  type="button"
                  role="option"
                  :aria-selected="selectedDiceSuggestion === index"
                  :class="{ 'dice-suggestion--selected': selectedDiceSuggestion === index }"
                  @mousedown.prevent
                  @click="applyDiceSuggestion(index)"
                >
                  <code>{{ suggestion.notation }}</code>
                  <span>{{ t(suggestion.label) }}</span>
                </button>
                <small>{{ t('chat.diceSuggestionsKeyboard') }}</small>
              </div>
              <div v-if="bonusPointsEnabled" class="composer-footer">
              <v-checkbox
                v-model="skipBonusPointRules"
                :label="t('bonusPoints.skipRulesForRoll')"
                density="compact"
                hide-details
                class="composer-bonus-option"
                :disabled="sending"
              />
                <v-tooltip location="top">
                  <template #activator="{ props: tooltipProps }">
                    <div
                      v-bind="tooltipProps"
                      class="bonus-points-counter"
                      :class="{ 'bonus-points-counter--empty': currentUserBonusPoints === 0 }"
                      role="status"
                      aria-live="polite"
                      aria-atomic="true"
                      :aria-label="t('bonusPoints.memberPoints', { current: currentUserBonusPoints, max: maxBonusPoints })"
                      tabindex="0"
                    >
                      <span class="bonus-points-counter__icon"><v-icon icon="mdi-star-four-points" size="26" /></span>
                      <div class="bonus-points-counter__copy"><span class="bonus-points-counter__label">{{ t('bonusPoints.title') }}</span><div class="bonus-points-counter__balance"><strong>{{ currentUserBonusPoints }}</strong><span>/ {{ maxBonusPoints }}</span></div></div>
                      <span class="bonus-points-counter__meter" aria-hidden="true"><span :style="{ width: `${bonusPointProgress}%` }" /></span>
                    </div>
                  </template>
                  <span>{{ t('bonusPoints.memberPoints', { current: currentUserBonusPoints, max: maxBonusPoints }) }}</span>
                </v-tooltip>
              </div>
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
  <nav v-if="room && currentUser" v-show="!settingsDialog && !bagOpen && !talentsOpen" class="room-tools-rail" :aria-label="t('chat.roomToolsTitle')">
    <v-btn data-room-panel-trigger class="room-tool-button" variant="tonal" :aria-label="t('chat.roomSettings')" @click="openSettingsPanel()">
      <v-icon icon="mdi-cog" />
      <span class="room-tool-label" aria-hidden="true">{{ t('navigation.settings') }}</span>
    </v-btn>
    <v-btn v-if="room.bagEnabled && roomAccess.rights.viewBag" class="room-tool-button" color="amber-darken-2" variant="tonal" :aria-label="t('bag.title')" @click="inspectedUserId = undefined; bagOpen = true">
      <v-icon icon="mdi-bag-personal" />
      <span class="room-tool-label" aria-hidden="true">{{ t('bag.title') }}</span>
    </v-btn>
    <v-btn class="room-tool-button" variant="tonal" color="teal" :aria-label="t('roomSettings.tabs.dices')" :aria-expanded="toolsPanel === 'dices'" aria-controls="room-tools-panel" @click="toggleTools('dices')">
      <v-icon icon="mdi-dice-multiple-outline" />
      <span class="room-tool-label" aria-hidden="true">{{ t('roomSettings.tabs.dices') }}</span>
    </v-btn>
    <v-btn v-if="roomAccess.rights.viewRollAwards" class="room-tool-button" variant="tonal" color="purple" :aria-label="t('rollAwards.title')" :aria-expanded="toolsPanel === 'rollAwards'" aria-controls="room-tools-panel" @click="toggleTools('rollAwards')">
      <v-icon icon="mdi-trophy-outline" />
      <span class="room-tool-label" aria-hidden="true">{{ t('rollAwards.title') }}</span>
    </v-btn>
    <v-btn v-if="talentsService?.state.snapshot?.settings.enabled" class="room-tool-button" variant="tonal" color="green" :aria-label="t('talents.title')" @click="talentsOpen = true; settingsDialog = false; bagOpen = false; toolsPanel = null"><v-icon icon="mdi-file-tree" /><span class="room-tool-label" aria-hidden="true">{{ t('talents.title') }}</span></v-btn>
    <v-btn data-room-panel-trigger class="room-tool-button" variant="tonal" color="blue" :aria-label="t('sessions.recap.historyButton')" :aria-expanded="sessionHistoryOpen" @click="historySessionId = null; sessionHistoryOpen = !sessionHistoryOpen">
      <v-icon icon="mdi-book-clock-outline" />
      <span class="room-tool-label" aria-hidden="true">{{ t('sessions.recap.historyButton') }}</span>
    </v-btn>
    <v-btn v-if="canUseRoomDevTools" class="room-tool-button" variant="flat" color="warning" :aria-label="t('roomDevTools.open')" :aria-expanded="toolsPanel === 'devTools'" aria-controls="room-tools-panel" @click="toggleTools('devTools')">
      <v-icon icon="mdi-test-tube" />
      <span class="room-tool-label" aria-hidden="true">{{ t('roomDevTools.title') }}</span>
    </v-btn>
  </nav>
  <RoomTalentsViewer v-if="room && currentUser" :key="room.id + currentUser.id" v-model="talentsOpen" :room-id="room.id" :user-id="currentUser.id" />
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
          :bag-enabled="!!room?.bagEnabled"
          @open-bag="openDevBag"
          @send-message="sendMessageAs"
          @send-dice="sendDiceAs"
        />
      </div>
    </v-card>
  </RoomSlidePanel>
  <v-snackbar v-model="inviteLinkCopied" :timeout="2000" role="status">{{ t('chat.inviteLinkCopied') }}</v-snackbar>
  <RoomBagDialog v-if="room?.bagEnabled && (roomAccess.rights.viewBag || (canUseRoomDevTools && devBagUserId)) && currentUser" v-model="bagOpen" :key="room.id + (devBagUserId || currentUser.id)" :room-id="room.id" :user-id="devBagUserId || currentUser.id" :target-user-id="inspectedUserId" :dev-mode="canUseRoomDevTools && !!devBagUserId" />
  <RoomSettingsDialog
    v-model:open="settingsDialog"
    :room="room"
    :current-user="currentUser"
    :initial-tab="settingsPanelTab"
    @open-dice-editor="openDiceEditor"
  />
  <RoomSessionHistoryPanel v-model="sessionHistoryOpen" :room-id="room?.id ?? null" :initial-session-id="historySessionId" />
  <RoomDiceManagementDialog :settings-open="settingsDialog" v-model="diceEditor" :room="room" :current-user="currentUser" />
  </div>


  <v-dialog v-model="dicePrefixHelpDialog" max-width="560" scrollable aria-labelledby="dice-help-title">
    <v-card class="dice-help-dialog">
      <v-card-title class="dice-help-heading">
        <span class="dice-help-icon" aria-hidden="true"><v-icon icon="mdi-dice-d20-outline" size="28" /></span>
        <h2 id="dice-help-title">{{ t('chat.dicePrefixHelpTitle') }}</h2>
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
        <p class="dice-help-intro">{{ t('chat.dicePrefixHelp') }}</p>
        <section class="dice-help-examples" aria-labelledby="dice-help-examples-title">
          <h3 id="dice-help-examples-title">{{ t('chat.examples') }}</h3>
          <div class="dice-help-example dice-help-example--advantage">
            <span class="dice-help-example__icon" aria-hidden="true"><v-icon icon="mdi-arrow-up" size="20" /></span>
            <div><code>+2d100</code><p>{{ t('chat.diceSuggestionAdvantage') }}</p></div>
          </div>
          <div class="dice-help-example dice-help-example--disadvantage">
            <span class="dice-help-example__icon" aria-hidden="true"><v-icon icon="mdi-arrow-down" size="20" /></span>
            <div><code>-2d100</code><p>{{ t('chat.diceSuggestionDisadvantage') }}</p></div>
          </div>
        </section>
      </v-card-text>
      <v-card-actions class="dice-help-actions">
        <v-btn color="primary" variant="tonal" @click="dicePrefixHelpDialog = false">
          {{ t('common.close') }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>


</template>

<script setup lang="ts">
import { useRoomAccess } from 'core/composables/useRoomAccess';
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import type { RoomDetails, RoomDice, RoomMessage } from 'netlify/core/types/data.types';
import type { DiscordUser } from 'netlify/core/types/discord.types';
import { RoomDiceManagerKey, useRoomDiceManager } from 'core/composables/useRoomDiceManager';
import { RoomRollAwardsManagerKey, useRoomRollAwardsManager } from 'core/composables/useRoomRollAwardsManager';
import { parseInlineDiceCommand, parseDiceNotation, type DiceRoll } from 'core/utils/dice.utils';
import { ROOM_MESSAGES_PAGE_SIZE, useRoomsStore } from 'core/stores/rooms.store';
import RoomMembersMenu from './RoomMembersMenu.component.vue';
import RoomMessagesList from './RoomMessagesList.component.vue';
import RoomDicePanel from './RoomDicePanel.component.vue';
import { talentRoom } from 'core/services/talents.service';
import RoomTalentsViewer from './RoomTalentsViewer.component.vue';
import RoomSlidePanel from './RoomSlidePanel.component.vue';
import RoomDiceManagementDialog from './RoomDiceManagementDialog.component.vue';
import RoomSessionStartDialog from './RoomSessionStartDialog.component.vue';
import RoomRollAwardsPanel from './RoomRollAwardsPanel.component.vue';
import { BagInspectionKey } from 'core/composables/useBagInspection';
import RoomBagDialog from './RoomBagDialog.component.vue';
import RoomSettingsDialog from './RoomSettingsDialog.component.vue';
import RoomSessionHistoryPanel from './RoomSessionHistoryPanel.component.vue';

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
const composerFocused = ref(false);
const diceSuggestionsDismissed = ref(false);
const selectedDiceSuggestion = ref(-1);
const diceSuggestions = computed(() => {
  const command = parseInlineDiceCommand(messageText.value);
  if (!command) return [];
  const { count, sides, modifier } = parseDiceNotation(command.notation);
  const notation = `${Math.max(2, count)}d${sides}${modifier > 0 ? '+' : ''}${modifier || ''}`;
  return [
    { prefix: '+', notation: `+${notation}`, label: 'chat.diceSuggestionAdvantage' },
    { prefix: '-', notation: `-${notation}`, label: 'chat.diceSuggestionDisadvantage' },
  ].filter(suggestion => suggestion.notation !== command.notation);
});
const showDiceSuggestions = computed(() => composerFocused.value && !props.sending && !diceSuggestionsDismissed.value && diceSuggestions.value.length > 0);
watch(messageText, () => {
  diceSuggestionsDismissed.value = false;
  selectedDiceSuggestion.value = -1;
}, { flush: 'sync' });

function applyDiceSuggestion(index: number) {
  const suggestion = diceSuggestions.value[index];
  if (!suggestion) return;
  // Replace only the command, preserving the user's description and spacing.
  messageText.value = messageText.value.replace(/^(\s*)[+-]?\d*d\d+(?:[+-]\d+)?/i, `$1${suggestion.notation}`);
  diceSuggestionsDismissed.value = true;
  focusMessageInput();
}

function handleComposerKeydown(event: KeyboardEvent) {
  if (event.isComposing || props.sending || event.target !== (event.currentTarget as HTMLElement).querySelector('input')) return;
  if (showDiceSuggestions.value) {
    const count = diceSuggestions.value.length;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const selected = selectedDiceSuggestion.value;
      selectedDiceSuggestion.value = selected < 0
        ? (event.key === 'ArrowDown' ? 0 : count - 1)
        : (selected + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      diceSuggestionsDismissed.value = true;
      return;
    }
    if (event.key === 'Enter' && selectedDiceSuggestion.value >= 0) {
      event.preventDefault();
      applyDiceSuggestion(selectedDiceSuggestion.value);
      return;
    }
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    sendMessage();
  }
}

const skipBonusPointRules = ref(false);
const messageInput = ref<{ focus: () => void } | null>(null);
const bagOpen = ref(false);
const talentsOpen = ref(false);
const talentsService = computed(() => props.room && props.currentUser ? talentRoom(props.room.id, props.currentUser.id) : null);
watch(talentsService, service => { if (service) void service.load(); talentsOpen.value = false; }, { immediate: true });
const devBagUserId = ref<string>();
const inspectedUserId = ref<string>();
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
const historySessionId = ref<string | null>(null);
watch(sessionHistoryOpen, open => { if (open) { settingsDialog.value = false; bagOpen.value = false; toolsPanel.value = null; } }, { flush: 'sync' });
watch(talentsOpen, value => { if (value) sessionHistoryOpen.value = false; });
watch([settingsDialog, bagOpen, toolsPanel], ([settings, bag, tools]) => { if (settings || bag || tools) sessionHistoryOpen.value = false; }, { flush: 'sync' });
const timerNow = ref(Date.now());
const pendingLoadDone = ref<InfiniteScrollDone | null>(null);
const loadingOlder = ref(false);
const hasLoadedOlder = ref(false);
let sessionBannerTimer: number | null = null;
let sessionClockTimer: number | null = null;

const roomAccess = useRoomAccess(computed(() => props.currentUser?.id));
function canInspectBag(roomId: string, targetUserId: string) {
  return props.room?.id === roomId && !props.room.archivedAt && !!props.room.bagEnabled
    && !!props.currentUser && props.currentUser.id !== targetUserId && roomAccess.value.rights.viewBag
    && roomsStore.members.some(member => member.userId === targetUserId);
}
provide(BagInspectionKey, {
  canOpen: canInspectBag,
  open: async targetUserId => {
    if (!props.room || !canInspectBag(props.room.id, targetUserId)) return;
    settingsDialog.value = false;
    toolsPanel.value = null;
    inspectedUserId.value = targetUserId;
    await nextTick();
    if (props.room && canInspectBag(props.room.id, targetUserId)) bagOpen.value = true;
  },
});
watch(() => roomsStore.members, () => {
  if (inspectedUserId.value && props.room && !canInspectBag(props.room.id, inspectedUserId.value)) bagOpen.value = false;
}, { deep: true });
watch(bagOpen, value => { if (!value) { inspectedUserId.value = undefined; devBagUserId.value = undefined; } });
const isRoomCreator = computed(() => roomAccess.value.rights.manageSessions);
watch(() => [props.room?.id, props.currentUser?.id, props.room?.bagEnabled, roomAccess.value.rights.viewBag] as const, (current, previous) => {
  if (!current[2] || !current[3] || current[0] !== previous[0] || current[1] !== previous[1]) bagOpen.value = false;
});
watch(canUseRoomDevTools, allowed => { if (!allowed) { if (toolsPanel.value === 'devTools') toolsPanel.value = null; if (devBagUserId.value) bagOpen.value = false; } });
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
watch(() => roomsStore.closedSessionForRecap, session => {
  if (session && session.roomId === props.room?.id) {
    historySessionId.value = session.id;
    sessionHistoryOpen.value = true;
    roomsStore.dismissSessionRecap();
  }
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
const inviteLinkCopied = ref(false);
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
const bonusPointProgress = computed(() => maxBonusPoints.value > 0 ? Math.min(100, Math.max(0, currentUserBonusPoints.value / maxBonusPoints.value * 100)) : 0);
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
  showSessionBanner.value = false;
  if (sessionBannerTimer !== null) { window.clearTimeout(sessionBannerTimer); sessionBannerTimer = null; }
  messageText.value = '';
  skipBonusPointRules.value = false;
  finishPendingLoad('ok');
  loadingOlder.value = false;
  hasLoadedOlder.value = false;
  resetInfiniteScroll();
  sessionHistoryOpen.value = false;
  historySessionId.value = null;
  showInviteCode.value = false;
  inviteLinkCopied.value = false;
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

async function openDevBag(userId: string) {
  if (!canUseRoomDevTools.value || !props.room?.bagEnabled || !roomsStore.members.some(member => member.userId === userId)) return;
  bagOpen.value = false; inspectedUserId.value = undefined; toolsPanel.value = null;
  await nextTick();
  devBagUserId.value = userId;
  await nextTick();
  if (canUseRoomDevTools.value && props.room?.bagEnabled) bagOpen.value = true;
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
    inviteLinkCopied.value = false;
    await navigator.clipboard.writeText(inviteLink.value);
    inviteLinkCopied.value = true;
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
  if (!props.room || roomsStore.currentSession?.roomId !== props.room.id) return;
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
.room-panel-host { position: relative; height: 100%; min-height: 0; overflow: hidden; border-radius: 18px; }
.room-chat-panel {
  min-height: 0;
  height: 100%;
  border: 1px solid rgba(var(--v-theme-primary), .16);
  border-radius: 18px;
  background: rgb(var(--v-theme-surface));
  display: flex;
  flex-direction: column;
}

.room-header-shell { position: relative; flex-shrink: 0; isolation: isolate; overflow: hidden; }
.session-start-banner { position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 14px; padding: 12px 20px; color: rgb(var(--v-theme-primary)); background: linear-gradient(110deg, rgba(var(--v-theme-primary), .11), rgba(var(--v-theme-primary), .025)), rgb(var(--v-theme-surface)); font-size: clamp(16px, 2vw, 21px); font-weight: 750; letter-spacing: -.02em; }
.session-start-banner__icon { display: grid; place-items: center; flex-shrink: 0; width: 42px; height: 42px; border: 1px solid rgba(var(--v-theme-primary), .2); border-radius: 14px; background: rgba(var(--v-theme-primary), .09); }
.session-start-banner::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(110deg, transparent 25%, rgba(var(--v-theme-primary), .1) 50%, transparent 75%); animation: session-banner-sweep 1.3s ease-out both; }
@keyframes session-banner-sweep { from { transform: translateX(-100%); } to { transform: translateX(100%); } }
.room-header--celebrating { opacity: 0; pointer-events: none; }

.room-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; flex-shrink: 0; gap: 10px; padding: 10px 18px; padding-right: 58px; transition: opacity 180ms ease; background: radial-gradient(ellipse at top left, rgba(var(--v-theme-primary), .095), transparent 70%); }
.room-identity { display: flex; align-items: center; gap: 14px; }
.room-identity__emblem { display: grid; place-items: center; width: 42px; height: 42px; flex-shrink: 0; border: 1px solid rgba(var(--v-theme-primary), .12); border-radius: 16px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .08); transform: rotate(-6deg); }
.room-identity__copy { min-width: 0; }
.room-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.room-title { font-size: clamp(17px, 2vw, 21px); font-weight: 750; letter-spacing: -.03em; line-height: 1.35; white-space: normal; overflow-wrap: anywhere; }
.room-title-row :deep(.v-chip) { font-size: 10px; border-radius: 7px; }
.room-invite { display: flex; align-items: center; gap: 3px; margin-top: 3px; color: rgba(var(--v-theme-on-surface), .55); }
.room-invite small { font-size: 11px; font-weight: 500; letter-spacing: .025em; }
.room-invite > .v-btn { width: 22px; height: 22px; border-radius: 8px; }
.room-chat-body { flex: 1; min-height: 0; padding: 14px 18px 16px; background: linear-gradient(180deg, rgba(var(--v-theme-primary), .015), transparent 180px), rgb(var(--v-theme-background)); }
.composer-footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px 12px; margin-top: 8px; }
.bonus-points-counter { position: relative; display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: auto; padding: 6px 10px 8px; overflow: hidden; border: 1px solid rgba(var(--v-theme-primary), .2); border-radius: 10px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .065); }
.bonus-points-counter__icon { display: grid; place-items: center; width: 26px; height: 26px; flex-shrink: 0; }
.bonus-points-counter__icon .v-icon { font-size: 20px !important; width: 20px; height: 20px; }
.bonus-points-counter__copy { display: flex; align-items: center; gap: 10px; line-height: 1; }
.bonus-points-counter__label { font-size: 10px; font-weight: 650; }
.bonus-points-counter__balance { display: flex; align-items: baseline; gap: 4px; font-variant-numeric: tabular-nums; }
.bonus-points-counter__balance strong { font-size: 19px; font-weight: 800; letter-spacing: -.03em; }
.bonus-points-counter__balance > span { font-size: 11px; font-weight: 600; opacity: .65; }
.bonus-points-counter__meter { position: absolute; bottom: 0; inset-inline: 0; height: 2px; background: rgba(var(--v-theme-primary), .07); }
.bonus-points-counter__meter > span { display: block; height: 100%; background: rgb(var(--v-theme-primary)); transition: width .25s ease; }
.bonus-points-counter--empty { background: rgba(var(--v-theme-primary), .025); }
.bonus-points-counter:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: 2px; }
.conversation-empty { display: flex; flex-direction: column; align-items: center; padding: 60px 20px; text-align: center; }
.conversation-empty > span { display: grid; place-items: center; width: 80px; height: 80px; border: 1px solid rgba(var(--v-theme-primary), .12); border-radius: 24px; background: rgba(var(--v-theme-primary), .055); color: rgb(var(--v-theme-primary)); margin-bottom: 20px; }
.conversation-empty h2 { font-size: 19px; font-weight: 700; letter-spacing: -.02em; }
.conversation-empty p { max-width: 320px; font-size: 13px; line-height: 1.7; margin-top: 8px; color: rgba(var(--v-theme-on-surface), .6); }
.chat-input { flex-shrink: 0; padding: 10px; margin-top: 12px; border: 1px solid rgba(var(--v-theme-primary), .14); border-radius: 16px; background: rgb(var(--v-theme-surface)); box-shadow: 0 4px 20px rgba(0, 0, 0, .025); }
.dice-suggestions { display: grid; gap: 4px; margin-top: 8px; }
.dice-suggestions button { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 8px; text-align: left; color: rgb(var(--v-theme-on-surface)); font-size: 12px; }
.dice-suggestions button:is(:hover, :focus-visible), .dice-suggestions .dice-suggestion--selected { background: rgba(var(--v-theme-primary), .12); }
.dice-suggestions code { color: rgb(var(--v-theme-primary)); font-weight: 700; }
.dice-suggestions small { padding: 4px 10px; color: rgba(var(--v-theme-on-surface), .6); font-size: 11px; }
.chat-input :deep(.v-field) { border-radius: 10px; }
.chat-input :deep(.v-field__outline) { opacity: .55; }
.chat-input :deep(.v-field--focused .v-field__outline) { opacity: 1; }
.chat-input :deep(.v-field__input) { font-size: 14px; }
.chat-input .composer-send { width: 36px; height: 36px; border-radius: 10px; }
.composer-bonus-option { flex: 1; min-width: 120px; margin: 0; }
.composer-bonus-option :deep(.v-label) { font-size: 11px; line-height: 1.5; }
.room-header > :first-child { min-width: 0; }
.room-header-actions { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 8px; max-width: 100%; margin-inline-start: auto; }
.room-header-actions :deep(.v-btn),
.room-header-actions :deep(.v-chip) { height: 32px; min-height: 32px; border-radius: 4px; font-size: 12px; font-weight: 600; letter-spacing: .025em; }
.room-header-actions :deep(.v-btn:not(.v-btn--icon)) { padding-inline: 12px; }
.room-header-actions :deep(.v-btn--icon) { width: 32px; min-width: 32px; padding: 0; }
.room-header-actions :deep(.v-chip) { padding-inline: 10px; }
.room-header-actions :deep(.v-btn .v-icon),
.room-header-actions :deep(.v-chip .v-icon) { font-size: 18px; width: 18px; height: 18px; }
@media (max-width: 599px) {
  .room-header-actions { width: 100%; justify-content: flex-start; margin-inline-start: 0; }
}

.session-timer {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  padding-inline: 10px;
  border: 1px solid rgba(var(--v-theme-primary), .1);
  border-radius: 9px;
  background: rgba(var(--v-theme-primary), .035);
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
  flex: 1;
  min-height: 0;
  padding: 10px 8px 8px 0;
  height: 100%;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.dice-help-dialog { border: 1px solid rgba(var(--v-theme-primary), .16); border-radius: 20px !important; }
.dice-help-heading { display: flex; align-items: center; gap: 14px; padding: 24px; white-space: normal; background: linear-gradient(120deg, rgba(var(--v-theme-primary), .12), transparent); }
.dice-help-icon { display: grid; place-items: center; flex-shrink: 0; width: 52px; height: 52px; border: 1px solid rgba(var(--v-theme-primary), .16); border-radius: 16px; background: rgba(var(--v-theme-primary), .08); color: rgb(var(--v-theme-primary)); }
.dice-help-heading h2 { flex: 1; min-width: 0; font-size: 20px; line-height: 1.4; font-weight: 700; letter-spacing: -.025em; }
.dice-help-heading > .v-btn { flex-shrink: 0; }
.dice-prefix-help-content { display: grid; gap: 24px; padding: 24px !important; }
.dice-help-intro { font-size: 14px; line-height: 1.7; color: rgba(var(--v-theme-on-surface), .72); }
.dice-help-examples { display: grid; gap: 12px; }
.dice-help-examples h3 { font-size: 12px; font-weight: 700; color: rgba(var(--v-theme-on-surface), .6); }
.dice-help-example { display: flex; align-items: center; gap: 14px; padding: 16px; border: 1px solid rgba(var(--v-border-color), .12); border-radius: 14px; background: rgba(var(--v-theme-on-surface), .025); }
.dice-help-example__icon { display: grid; place-items: center; flex-shrink: 0; width: 36px; height: 36px; border-radius: 10px; }
.dice-help-example--advantage .dice-help-example__icon { background: rgba(var(--v-theme-success), .1); color: rgb(var(--v-theme-success)); }
.dice-help-example--disadvantage .dice-help-example__icon { background: rgba(var(--v-theme-warning), .1); color: rgb(var(--v-theme-warning)); }
.dice-help-example code { font-family: ui-monospace, monospace; font-size: 20px; font-weight: 700; letter-spacing: -.03em; }
.dice-help-example p { margin-top: 4px; font-size: 13px; line-height: 1.6; color: rgba(var(--v-theme-on-surface), .7); }
.dice-help-actions { justify-content: flex-end; padding: 16px 24px; border-top: 1px solid rgba(var(--v-border-color), .1); }
.dice-help-actions .v-btn { padding-inline: 20px; border-radius: 10px; text-transform: none; letter-spacing: 0; }
@media (max-width: 599px) {
  .dice-help-heading { padding: 18px 16px; gap: 10px; }
  .dice-help-heading h2 { font-size: 18px; }
  .dice-help-icon { width: 40px; height: 44px; border-radius: 12px; }
  .dice-prefix-help-content { padding: 20px 16px !important; gap: 20px; }
  .dice-help-example { padding: 14px 12px; gap: 12px; }
  .dice-help-actions { padding: 12px 16px; }
}

.chat-layout { display: flex; height: 100%; min-height: 0; overflow: hidden; }
.chat-section { display: flex; flex-direction: column; height: 100%; min-width: 0; width: 100%; padding-right: 48px; }
.room-tools-rail { pointer-events: none; position: absolute; right: 4px; top: 112px; z-index: 1102; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
.room-tools-rail .room-tool-button { pointer-events: auto; min-width: 40px; height: 44px; padding-inline: 8px; border-radius: 10px 0 0 10px; background: rgb(var(--v-theme-surface)); }
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

<style scoped>
@media (max-width: 599px) {
  .room-header { padding: 8px 58px 8px 12px; gap: 8px; }
  .room-identity { gap: 10px; }
  .room-identity__emblem { width: 36px; height: 36px; border-radius: 10px; }
  .room-title-row { gap: 6px; }
  .room-header-actions { gap: 8px; }
  .composer-footer { gap: 6px 8px; }
  .bonus-points-counter { padding: 6px 8px 7px; gap: 5px; }
  .bonus-points-counter__copy { flex-direction: column; align-items: flex-start; gap: 3px; }
  .bonus-points-counter__balance strong { font-size: 16px; }
  .bonus-points-counter__label { font-size: 9px; }
  .room-chat-body { padding: 10px 10px 12px; }
  .chat-input { padding: 6px; border-radius: 12px; margin-top: 8px; }
  .conversation-empty { padding: 32px 12px; }
}
@media (prefers-reduced-motion: reduce) {
  .bonus-points-counter__meter > span, .room-header, .session-header-enter-active, .session-header-leave-active { transition: none; }
  .session-start-banner::after { display: none; animation: none; }
}
</style>
