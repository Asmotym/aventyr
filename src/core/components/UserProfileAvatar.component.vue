<template>
  <v-menu
    v-if="userId"
    v-model="menuOpen"
    :location="menuLocation"
    :close-on-content-click="false"
    offset="8"
    max-width="380"
  >
    <template #activator="{ props: activatorProps }">
      <button
        v-bind="activatorProps"
        type="button"
        :class="['profile-avatar-button', classes]"
        :style="buttonStyle"
        :aria-label="t('profile.open', { name: displayName })"
      >
        <v-avatar :size="size" :color="color">
          <v-img v-if="avatar" :src="avatar" :alt="displayName" cover />
          <v-icon v-else icon="mdi-account" :size="fallbackIconSize" />
        </v-avatar>
      </button>
    </template>

    <v-card class="profile-popup" elevation="10">
      <v-progress-linear v-if="loading" indeterminate color="primary" />
      <v-card-text v-if="loading && !profile" class="text-center py-8">
        <div class="text-body-2 text-medium-emphasis">{{ t('profile.loading') }}</div>
      </v-card-text>
      <v-card-text v-else-if="error && !profile" class="text-center py-6">
        <v-icon icon="mdi-alert-circle-outline" color="error" size="32" class="mb-2" />
        <div class="text-body-2 mb-3">{{ error }}</div>
        <v-btn size="small" variant="tonal" color="primary" @click="loadProfile">
          {{ t('common.retry') }}
        </v-btn>
      </v-card-text>
      <template v-else-if="profile">
        <v-card-text>
          <div class="profile-popup__identity">
            <v-avatar size="72" color="primary">
              <v-img v-if="profile.avatar" :src="profile.avatar" :alt="profile.username" cover />
              <v-icon v-else icon="mdi-account" size="40" />
            </v-avatar>
            <div class="profile-popup__username text-h6">{{ profile.username }}</div>
          </div>

          <v-divider class="my-4" />
          <div class="text-subtitle-2 mb-1">{{ t('profile.aboutMe') }}</div>
          <div v-if="profile.aboutMe" class="profile-popup__about text-body-2">
            {{ profile.aboutMe }}
          </div>
          <div v-else class="text-body-2 text-medium-emphasis">
            {{ t('profile.aboutEmpty') }}
          </div>

          <template v-if="profile.room">
            <v-divider class="my-4" />
            <div class="text-subtitle-2 mb-2">{{ t('profile.roomInformation') }}</div>
            <v-card
              v-if="profile.room.bonusPoints"
              variant="tonal"
              color="primary"
              class="profile-popup__stat mb-2"
            >
              <v-icon icon="mdi-star-four-points" size="20" />
              <span>{{ t('profile.bonusPoints', {
                current: profile.room.bonusPoints.current,
                maximum: profile.room.bonusPoints.maximum,
              }) }}</span>
            </v-card>
            <v-card
              v-if="profile.room.rollAwards?.length"
              variant="tonal"
              class="pa-3"
            >
              <div class="d-flex align-center ga-2 text-subtitle-2 mb-2">
                <v-icon icon="mdi-trophy-outline" size="20" />
                <span>{{ t('profile.rollAwards') }}</span>
              </div>
              <div
                v-for="award in profile.room.rollAwards"
                :key="award.id"
                class="profile-popup__award"
              >
                <div>
                  <div class="text-body-2 font-weight-medium">{{ award.name }}</div>
                  <div v-if="award.description" class="text-caption text-medium-emphasis">
                    {{ award.description }}
                  </div>
                </div>
                <v-chip size="x-small" color="primary" variant="tonal">
                  {{ t(award.usedAt ? 'sessionAwards.used' : 'sessionAwards.available') }}
                </v-chip>
              </div>
            </v-card>
          </template>
        </v-card-text>
      </template>
    </v-card>
  </v-menu>

  <v-avatar v-else :size="size" :color="color">
    <v-img v-if="avatar" :src="avatar" :alt="displayName" cover />
    <v-icon v-else icon="mdi-account" :size="fallbackIconSize" />
  </v-avatar>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoomsStore } from 'core/stores/rooms.store';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';
import type { PublicUserProfile } from 'netlify/core/types/data.types';
import { fetchPublicUserProfile } from 'core/services/user-profiles.service';

const props = withDefaults(defineProps<{
  userId?: string | null;
  avatar?: string | null;
  displayName: string;
  size?: number | string;
  color?: string;
  roomId?: string | null;
  classes?: string[];
}>(), {
  userId: null,
  avatar: null,
  size: 36,
  color: undefined,
  roomId: null,
  classes: undefined,
});

const { t } = useI18n();
const { smAndDown } = useDisplay();
const menuOpen = ref(false);
const profile = ref<PublicUserProfile | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const menuLocation = computed(() => smAndDown.value ? 'bottom' : 'end');
const numericSize = computed(() => Number(props.size) || 36);
const fallbackIconSize = computed(() => Math.max(18, Math.round(numericSize.value * 0.55)));
const buttonStyle = computed(() => ({
  width: `${numericSize.value}px`,
  height: `${numericSize.value}px`,
}));

const roomsStore = useRoomsStore();
watch(() => roomsStore.currentSession, () => { if (menuOpen.value) void loadProfile(); });
watch(menuOpen, (open) => {
  if (open) void loadProfile();
});

watch(() => [props.userId, props.roomId], () => {
  profile.value = null;
  error.value = null;
  menuOpen.value = false;
});

async function loadProfile() {
  if (!props.userId || loading.value) return;
  loading.value = true;
  profile.value = null;
  error.value = null;
  try {
    profile.value = await fetchPublicUserProfile(props.userId, props.roomId ?? undefined);
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : t('profile.loadError');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.profile-avatar-button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  cursor: pointer;
}

.profile-avatar-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.profile-popup {
  width: min(360px, calc(100vw - 24px));
  max-height: min(620px, calc(100vh - 24px));
  overflow-y: auto;
}

.profile-popup__identity {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
}

.profile-popup__username {
  min-width: 0;
  overflow-wrap: anywhere;
}

.profile-popup__about {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.profile-popup__stat {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
}

.profile-popup__award {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding-block: 6px;
}
</style>
