<template>
  <v-window-item eager value="room" class="room-settings-room-tab">
    <header class="general-hero">
      <div class="general-hero__icon"><v-icon icon="mdi-home-edit-outline" size="36" /></div>
      <div class="general-hero__copy"><div class="room-settings-room-tab__general-eyebrow">{{ context.t('roomSettings.tabs.room') }}</div><h2>{{ context.room?.name }}</h2></div>
      <v-chip color="primary" variant="tonal" size="small">{{ context.t('roomAccess.roles.' + context.memberRole.value) }}</v-chip>
    </header>
    <div class="room-settings-room-tab__general-grid">
    <section class="room-settings-room-tab__general-card">
      <h3 class="room-settings-room-tab__general-section-title"><span class="room-settings-room-tab__section-icon"><v-icon icon="mdi-door-open" size="21" /></span>{{ context.t('roomSettings.roomDetails.title') }}</h3>
      <p class="text-caption text-medium-emphasis mb-3">
        {{ context.isRoomCreator.value ? context.t('roomSettings.roomDetails.creatorHelp') : context.t('roomSettings.roomDetails.nonCreatorHelp') }}
      </p>
      <v-text-field
        v-model="context.roomNameInput.value"
        :label="context.t('rooms.sidebar.roomName')"
        variant="outlined"
        density="comfortable"
        :counter="80"
        maxlength="80"
        :disabled="!context.isRoomCreator.value || context.settingsSaving.value"
        :error="!!(context.roomNameError.value)"
        :hint="context.t('roomSettings.roomDetails.maxRoomName')"
        persistent-hint
      />
    </section>

    <section v-if="context.isRoomCreator.value" class="room-settings-room-tab__general-card">
      <h3 class="room-settings-room-tab__general-section-title"><span class="room-settings-room-tab__section-icon"><v-icon icon="mdi-timer-outline" size="21" /></span>{{ context.t('sessions.settings.title') }}</h3>
      <v-text-field
        v-model.number="context.sessionInactivityInput.value"
        type="number"
        min="1"
        max="10080"
        step="1"
        :label="context.t('sessions.settings.inactivity')"
        :hint="context.t('sessions.settings.hint')"
        persistent-hint
        variant="outlined"
        density="comfortable"
        :disabled="context.settingsSaving.value"
        :error="!!(context.sessionInactivityError.value)"
      />
    </section>



    <section class="room-settings-room-tab__general-card room-settings-room-tab__nickname-card">
      <h3 class="room-settings-room-tab__general-section-title"><span class="room-settings-room-tab__section-icon"><v-icon icon="mdi-account-edit-outline" size="21" /></span>{{ context.t('roomSettings.nickname.title') }}</h3>
      <p class="text-caption text-medium-emphasis mb-3">
        {{ context.t('roomSettings.nickname.help') }}
      </p>
      <div v-if="context.memberSettingsError.value" class="error-recovery-actions"><v-btn
          variant="text"
          size="small"
          class="ml-2"
          @click="context.ensureMemberSettingsLoaded(true)"
        >
          {{ context.t('common.retry') }}
        </v-btn></div>
      <v-progress-linear
        v-if="context.memberSettingsLoading.value"
        indeterminate
        color="primary"
        class="mb-3"
      />
      <v-text-field
        v-model="context.nicknameInput.value"
        :label="context.t('roomSettings.nickname.label')"
        variant="outlined"
        density="comfortable"
        :counter="40"
        maxlength="40"
        :disabled="!context.access.value.rights.editNickname || context.memberSettingsLoading.value || context.settingsSaving.value"
        :error="!!(context.nicknameError.value)"
        :hint="context.t('roomSettings.nickname.maxNickname')"
        persistent-hint
      />
      <div class="room-settings-room-tab__nickname-preview"><v-icon icon="mdi-account-circle-outline" size="24" /><span>
        {{ context.t('roomSettings.nickname.preview', { name: context.nicknamePreview.value }) }}
      </span></div>
    </section>
    </div>
    <section class="room-settings-room-tab__general-card room-settings-room-tab__rights-card">
      <h3 class="room-settings-room-tab__general-section-title"><span class="room-settings-room-tab__section-icon"><v-icon icon="mdi-shield-account-outline" size="21" /></span>{{ context.t('roomAccess.yourRights') }}</h3>
      <p class="text-body-2 mt-2">{{ context.t('roomRework.rightsRole') }}: <strong>{{ context.t('roomAccess.roles.' + context.memberRole.value) }}</strong></p>
      <div class="room-settings-room-tab__rights-groups">
        <section v-for="group in permissionGroups" :key="group.title" class="room-settings-room-tab__rights-group">
          <h3 class="text-subtitle-2 mb-2">{{ context.t(group.title) }}</h3>
          <div v-for="right in group.keys" :key="right" class="room-settings-room-tab__rights-row" :class="{ 'room-settings-room-tab__rights-row--unavailable': !context.access.value.rights[right] }"><v-icon size="18" :color="context.access.value.rights[right] ? 'success' : undefined" :icon="context.access.value.rights[right] ? 'mdi-check-circle-outline' : 'mdi-minus-circle-outline'" /><span>{{ context.t('roomAccess.permissions.' + right) }}</span></div>
        </section>
      </div>

    </section>
    <div class="room-settings-room-tab__general-save-bar"><v-btn color="primary" variant="flat" prepend-icon="mdi-check" :disabled="!context.hasPendingChanges.value || context.settingsSaving.value" :loading="context.settingsSaving.value" @click="context.saveSettings">{{ context.t('common.save') }}</v-btn></div>
  </v-window-item>
</template>

<script setup lang="ts">
import { permissionGroups } from '@/features/rooms/components/settings/room-permission-groups';
import type { RoomSettingsContext } from '@/features/rooms/composables/useRoomSettings';
defineProps<{
  context: RoomSettingsContext;
}>();
</script>

<style scoped lang="scss" src="@/assets/styles/features/rooms/settings/room-settings-room-tab.scss"></style>
