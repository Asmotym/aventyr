<template>
  <v-window-item value="room">
    <section class="mb-6">
      <div class="text-subtitle-2 mb-2">{{ context.t('roomSettings.roomDetails.title') }}</div>
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

    <section v-if="context.isRoomCreator.value">
      <div class="text-subtitle-2 mb-2">{{ context.t('sessions.settings.title') }}</div>
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

    <v-divider class="my-4" />

    <section>
      <div class="text-subtitle-2 mb-2">{{ context.t('roomSettings.nickname.title') }}</div>
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
        :disabled="context.memberSettingsLoading.value || context.settingsSaving.value"
        :error-messages="context.nicknameError.value ? [context.nicknameError.value] : []"
        :hint="context.t('roomSettings.nickname.maxNickname')"
        persistent-hint
      />
      <div class="text-caption text-medium-emphasis mb-3">
        {{ context.t('roomSettings.nickname.preview', { name: context.nicknamePreview.value }) }}
      </div>
    </section>
  </v-window-item>
</template>

<script setup lang="ts">
defineProps<{
  context: any;
}>();
</script>
