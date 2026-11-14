<template>
  <v-window-item eager value="room" class="general-settings">
    <header class="general-hero">
      <div class="general-hero__icon"><v-icon icon="mdi-home-edit-outline" size="36" /></div>
      <div class="general-hero__copy"><div class="general-eyebrow">{{ context.t('roomSettings.tabs.room') }}</div><h2>{{ context.room?.name }}</h2></div>
      <v-chip color="primary" variant="tonal" size="small">{{ context.t('roomAccess.roles.' + context.memberRole.value) }}</v-chip>
    </header>
    <div class="general-grid">
    <section class="general-card">
      <h3 class="general-section-title"><span class="section-icon"><v-icon icon="mdi-door-open" size="21" /></span>{{ context.t('roomSettings.roomDetails.title') }}</h3>
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
        :error-messages="context.roomNameError.value ? [context.roomNameError.value] : []"
        :hint="context.t('roomSettings.roomDetails.maxRoomName')"
        persistent-hint
      />
    </section>

    <section v-if="context.isRoomCreator.value" class="general-card">
      <h3 class="general-section-title"><span class="section-icon"><v-icon icon="mdi-timer-outline" size="21" /></span>{{ context.t('sessions.settings.title') }}</h3>
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
        :error-messages="context.sessionInactivityError.value ? [context.sessionInactivityError.value] : []"
      />
    </section>



    <section class="general-card nickname-card">
      <h3 class="general-section-title"><span class="section-icon"><v-icon icon="mdi-account-edit-outline" size="21" /></span>{{ context.t('roomSettings.nickname.title') }}</h3>
      <p class="text-caption text-medium-emphasis mb-3">
        {{ context.t('roomSettings.nickname.help') }}
      </p>
      <v-alert
        v-if="context.memberSettingsError.value"
        type="error"
        variant="tonal"
        density="comfortable"
        class="mb-3"
      >
        {{ context.memberSettingsError.value }}
        <v-btn
          variant="text"
          size="small"
          class="ml-2"
          @click="context.ensureMemberSettingsLoaded(true)"
        >
          {{ context.t('common.retry') }}
        </v-btn>
      </v-alert>
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
        :error-messages="context.nicknameError.value ? [context.nicknameError.value] : []"
        :hint="context.t('roomSettings.nickname.maxNickname')"
        persistent-hint
      />
      <div class="nickname-preview"><v-icon icon="mdi-account-circle-outline" size="24" /><span>
        {{ context.t('roomSettings.nickname.preview', { name: context.nicknamePreview.value }) }}
      </span></div>
    </section>
    </div>
    <section class="general-card rights-card">
      <h3 class="general-section-title"><span class="section-icon"><v-icon icon="mdi-shield-account-outline" size="21" /></span>{{ context.t('roomAccess.yourRights') }}</h3>
      <p class="text-body-2 mt-2">{{ context.t('roomRework.rightsRole') }}: <strong>{{ context.t('roomAccess.roles.' + context.memberRole.value) }}</strong></p>
      <div class="rights-groups">
        <section v-for="group in permissionGroups" :key="group.title" class="rights-group">
          <h3 class="text-subtitle-2 mb-2">{{ context.t(group.title) }}</h3>
          <div v-for="right in group.keys" :key="right" class="rights-row" :class="{ 'is-unavailable': !context.access.value.rights[right] }"><v-icon size="18" :color="context.access.value.rights[right] ? 'success' : undefined" :icon="context.access.value.rights[right] ? 'mdi-check-circle-outline' : 'mdi-minus-circle-outline'" /><span>{{ context.t('roomAccess.permissions.' + right) }}</span></div>
        </section>
      </div>

    </section>
    <div class="general-save-bar"><v-btn color="primary" variant="flat" prepend-icon="mdi-check" :disabled="!context.hasPendingChanges.value || context.settingsSaving.value" :loading="context.settingsSaving.value" @click="context.saveSettings">{{ context.t('common.save') }}</v-btn></div>
  </v-window-item>
</template>

<script setup lang="ts">
import { permissionGroups } from './room-permission-groups';
import type { RoomSettingsContext } from '../RoomSettingsDialog.component.vue';
defineProps<{
  context: RoomSettingsContext;
}>();
</script>

<style scoped>
.general-hero { display: flex; align-items: center; flex-wrap: wrap; gap: 18px; padding: 24px; margin-bottom: 24px; border: 1px solid rgba(var(--v-theme-primary), .15); border-radius: 14px; background: linear-gradient(120deg, rgba(var(--v-theme-primary), .14), rgba(var(--v-theme-primary), .02)); }
.general-hero__icon { display: grid; place-items: center; width: 64px; height: 64px; border-radius: 18px; background: rgba(var(--v-theme-primary), .1); color: rgb(var(--v-theme-primary)); transform: rotate(-6deg); }
.general-hero__copy { flex: 1; min-width: 120px; overflow-wrap: anywhere; }
.general-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: rgb(var(--v-theme-primary)); margin-bottom: 4px; }
.general-hero h2 { font-size: 24px; line-height: 1.3; letter-spacing: -.03em; }
.general-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); gap: 20px; }
.general-card { padding: 22px; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 14px; background: rgb(var(--v-theme-surface)); min-width: 0; }
.general-section-title { display: flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 650; margin-bottom: 18px; }
.section-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: rgba(var(--v-theme-primary), .08); color: rgb(var(--v-theme-primary)); flex-shrink: 0; }
.nickname-card { grid-column: 1 / -1; }
.nickname-preview { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 10px; margin-top: 12px; background: rgba(var(--v-theme-primary), .05); font-size: 13px; overflow-wrap: anywhere; }
.nickname-preview > .v-icon { color: rgb(var(--v-theme-primary)); }
.rights-card { margin-top: 24px; }
.rights-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px; margin-top: 20px; }
.rights-group { padding: 18px; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 12px; background: rgba(var(--v-theme-on-surface), .015); }
.rights-group h3 { padding-bottom: 10px; border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); }
.rights-row { display: flex; gap: 10px; align-items: start; margin-block: 12px; font-size: 13px; line-height: 1.5; }
.rights-row .v-icon { margin-top: 1px; flex-shrink: 0; }
.rights-row.is-unavailable { color: rgba(var(--v-theme-on-surface), .45); }
.general-save-bar { display: flex; justify-content: flex-end; padding: 16px 0 0; }
.general-save-bar .v-btn { border-radius: 10px; min-width: 120px; }
@media (max-width: 600px) { .general-hero { padding: 18px; gap: 12px; } .general-hero h2 { font-size: 20px; } .general-hero__icon { width: 48px; height: 52px; } .general-card { padding: 18px; } }
</style>
