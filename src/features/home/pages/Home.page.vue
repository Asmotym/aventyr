<template>
    <HeaderComponent />
    <v-container
      v-if="userLoggedIn"
      class="py-6 home-container"
      :class="{ 'home-container--dashboard': isConnectedDashboard, 'home-container--room': !isConnectedDashboard }"
    >
        <v-row v-if="isConnectedDashboard" class="home-dashboard" align="stretch">
          <v-col v-if="!smAndDown" cols="12" md="4" class="dashboard-column">
            <RoomsBoard dashboard />
          </v-col>
          <v-col cols="12" md="8" class="dashboard-column dashboard-scroll-column">
            <v-btn v-if="smAndDown" class="mobile-rooms-trigger" color="primary" variant="tonal" prepend-icon="mdi-dice-multiple-outline" :aria-label="t('home.openRooms')" :aria-expanded="mobileRoomsOpen" aria-haspopup="dialog" @click="mobileRoomsOpen = true">
              {{ t('rooms.sidebar.title') }}<v-chip size="x-small" color="primary" variant="flat" class="ml-2">{{ roomCount }}</v-chip><v-icon icon="mdi-chevron-right" size="18" class="ml-auto" />
            </v-btn>
            <section class="home-hub" :aria-label="t('home.journalTitle')">
              <header class="home-hub__hero">
                <div class="home-hub__emblem"><v-icon icon="mdi-compass-rose" size="30" /></div>
                <div class="home-hub__welcome">
                  <span class="home-hub__eyebrow">{{ t('home.journalTitle') }}</span>
                  <i18n-t keypath="home.connectedWelcome" tag="h1" scope="global"><template #name><strong class="home-hub__username">{{ currentUser?.username ?? t('common.someone') }}</strong></template></i18n-t>
                  <p>{{ t('home.connectedIntro') }}</p>
                </div>
                <v-icon class="home-hub__decoration" icon="mdi-dice-d20-outline" size="140" aria-hidden="true" />
              </header>
              <div class="home-hub__scroll" tabindex="0" :aria-label="t('home.journalTitle')">
                <div class="home-hub__guides">
                  <article class="adventure-guide">
                    <span class="adventure-guide__icon"><v-icon icon="mdi-flag-outline" size="24" /></span>
                    <div><h2>{{ t('home.tutorial.createTitle') }}</h2><p>{{ t('home.tutorial.createText') }}</p></div>
                  </article>
                  <article class="adventure-guide adventure-guide--join">
                    <span class="adventure-guide__icon"><v-icon icon="mdi-ticket-confirmation-outline" size="24" /></span>
                    <div><h2>{{ t('home.tutorial.joinTitle') }}</h2><p>{{ t('home.tutorial.joinText') }}</p></div>
                  </article>
                </div>
                <div class="home-hub__news"><NewsSection :limit="3" /></div>
              </div>
            </section>
          </v-col>
        </v-row>
        <RoomsBoard v-else />
        <v-dialog v-if="isConnectedDashboard && smAndDown" v-model="mobileRoomsOpen" fullscreen eager transition="dialog-bottom-transition" :aria-label="t('rooms.sidebar.title')">
          <v-card class="mobile-rooms-view">
            <header class="mobile-rooms-view__header"><span class="mobile-rooms-view__icon"><v-icon icon="mdi-dice-multiple-outline" size="24" /></span><h2>{{ t('rooms.sidebar.title') }}</h2><AppCloseButton @click="mobileRoomsOpen = false" /></header>
            <div class="mobile-rooms-view__body"><RoomsBoard dashboard /></div>
          </v-card>
        </v-dialog>
    </v-container>
    <v-container v-else class="logged-out-home py-8">
      <div class="d-flex justify-center align-center login-panel">
        <v-card
          :title="t('home.not_logged_in_title')"
          :subtitle="t('home.not_logged_in_message')"
        >
        <!-- Prepend Aventyr icon -->
        <template v-slot:prepend>
          <img
            src="/aventyr-d100.svg"
            :alt="t('common.logoAlt')"
            class="header-logo"
          />
        </template>

        <!-- Text slot -->
        <template v-slot:text>
          <div>
            <p>{{ t('home.not_logged_in_text_intro') }}</p>
            <p>{{ t('home.not_logged_in_text_login') }}</p>
          </div>
        </template>

        <!-- Discord Auth button -->
        <v-card-actions>
          <DiscordAuth :show-login-text="true" />
        </v-card-actions>
      </v-card>
      </div>
      <NewsSection :limit="3" class="mt-8" />
    </v-container>
</template>

<script setup lang="ts">
import AppCloseButton from '@/shared/ui/AppCloseButton.vue';
import { computed, ref, watch } from 'vue';
import { useDisplay } from 'vuetify';
import { useRoomsStore } from '@/features/rooms';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import HeaderComponent from '@/app/components/Header.component.vue';
import RoomsBoard from '@/features/rooms/components/RoomsBoard.component.vue';
import { DiscordService } from '@/features/auth';
import DiscordAuth from '@/features/auth/components/DiscordAuth.vue';
import NewsSection from '@/features/articles/components/NewsSection.component.vue';

const { t } = useI18n();
const route = useRoute();
const { smAndDown } = useDisplay();
const roomsStore = useRoomsStore();
const mobileRoomsOpen = ref(false);
const roomCount = computed(() => roomsStore.rooms.filter(room => !room.isArchived).length);
watch([() => route.fullPath, smAndDown], () => { mobileRoomsOpen.value = false; });

const discordService = DiscordService.getInstance();
const currentUser = computed(() => discordService.user.value);
const userLoggedIn = computed(() => {
  return discordService.user.value !== null;
});
const isConnectedDashboard = computed(() => !route.params.roomId);

</script>

<style scoped>
.home-container {
  max-width: 1800px;
  width: 100%;
  margin: 0 auto;
  height: 100%;
  max-height: calc(100vh - var(--v-layout-top) - var(--v-layout-bottom));
}

.home-container.home-container--room { max-width: none; padding: 15px !important; height: calc(100dvh - var(--v-layout-top) - var(--v-layout-bottom)); }

.home-dashboard {
  height: calc(100dvh - var(--v-layout-top) - var(--v-layout-bottom) - 48px);
  min-height: 0;
}

.dashboard-column {
  min-height: 0;
  height: 100%;
}

.dashboard-scroll-column { display: flex; min-height: 0; }
.home-hub { display: flex; flex-direction: column; width: 100%; height: 100%; min-height: 0; overflow: hidden; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 16px; background: rgb(var(--v-theme-surface)); }
.home-hub__hero { position: relative; display: flex; align-items: center; gap: 16px; flex-shrink: 0; overflow: hidden; padding: 16px 24px; border-bottom: 1px solid rgba(var(--v-theme-primary), .14); background: radial-gradient(ellipse at top right, rgba(var(--v-theme-primary), .17), transparent 65%), linear-gradient(120deg, rgba(var(--v-theme-primary), .07), transparent); }
.home-hub__emblem { display: grid; place-items: center; width: 56px; height: 56px; flex-shrink: 0; border-radius: 16px; background: rgba(var(--v-theme-primary), .1); color: rgb(var(--v-theme-primary)); transform: rotate(-7deg); }
.home-hub__welcome { position: relative; z-index: 1; min-width: 0; }
.home-hub__username { color: rgb(var(--v-theme-primary)); font-weight: 850; overflow-wrap: anywhere; }
.home-hub__eyebrow { font-size: 10px; font-weight: 750; text-transform: uppercase; letter-spacing: .16em; color: rgb(var(--v-theme-primary)); }
.home-hub__welcome h1 { font-size: clamp(22px, 2.3vw, 30px); line-height: 1.3; letter-spacing: -.03em; margin: 3px 0 4px; }
.home-hub__welcome p { font-size: 13px; line-height: 1.5; color: rgba(var(--v-theme-on-surface), .65); max-width: 640px; }
.home-hub__decoration { position: absolute; right: -28px; bottom: -36px; color: rgb(var(--v-theme-primary)); opacity: .07; transform: rotate(18deg); }
.home-hub__scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; scrollbar-gutter: stable; padding: 24px; }
.home-hub__scroll:focus-visible { outline: 2px solid rgb(var(--v-theme-primary)); outline-offset: -3px; }
.home-hub__guides { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 28px; }
.adventure-guide { display: flex; align-items: flex-start; gap: 12px; padding: 18px; border: 1px solid rgba(var(--v-theme-primary), .16); border-radius: 14px; background: rgba(var(--v-theme-primary), .035); }
.adventure-guide__icon { display: grid; place-items: center; flex-shrink: 0; width: 40px; height: 40px; border-radius: 12px; background: rgba(var(--v-theme-primary), .09); color: rgb(var(--v-theme-primary)); }
.adventure-guide--join { border-color: rgba(var(--v-theme-secondary), .18); background: rgba(var(--v-theme-secondary), .035); }
.adventure-guide--join .adventure-guide__icon { color: rgb(var(--v-theme-secondary)); background: rgba(var(--v-theme-secondary), .09); }
.adventure-guide h2 { font-size: 14px; font-weight: 700; margin-bottom: 6px; }
.adventure-guide p { font-size: 12px; line-height: 1.7; color: rgba(var(--v-theme-on-surface), .65); }
.home-hub__news { border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); padding-top: 24px; }

.mobile-rooms-trigger { width: 100%; height: 48px; flex-shrink: 0; border: 1px solid rgba(var(--v-theme-primary), .16); border-radius: 12px; text-transform: none; letter-spacing: 0; font-weight: 700; }
.mobile-rooms-trigger :deep(.v-btn__content) { flex: 1; justify-content: flex-start; }
.mobile-rooms-view { display: flex; flex-direction: column; height: 100dvh; min-height: 0; overflow: hidden !important; background: rgb(var(--v-theme-background)); }
.mobile-rooms-view__header { display: flex; align-items: center; gap: 12px; flex-shrink: 0; padding: 14px 16px; border-bottom: 1px solid rgba(var(--v-theme-primary), .16); background: rgb(var(--v-theme-surface)); }
.mobile-rooms-view__icon { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 12px; background: rgba(var(--v-theme-primary), .09); color: rgb(var(--v-theme-primary)); }
.mobile-rooms-view__header h2 { flex: 1; font-size: 19px; font-weight: 750; letter-spacing: -.025em; }
.mobile-rooms-view__body { flex: 1; min-height: 0; overflow: hidden; padding: 16px 16px max(16px, env(safe-area-inset-bottom)); }

.logged-out-home {
  max-width: 1100px;
}

.login-panel {
  min-height: 0;
  padding-block: 24px;
}

@media (max-width: 959px) {
  .home-container--dashboard {
    height: auto;
    max-height: none;
  }

  .home-dashboard {
    height: auto;
  }

  .dashboard-column {
    height: calc(100dvh - var(--v-layout-top) - var(--v-layout-bottom) - 48px);
    min-height: 320px;
  }

  .dashboard-scroll-column { flex-direction: column; gap: 12px; overflow: hidden; }
  .home-hub { flex: 1; height: auto; }
}
@media (max-width: 600px) {
  .home-hub__hero { padding: 14px 16px; gap: 12px; }
  .home-hub__emblem { width: 44px; height: 44px; border-radius: 12px; }
  .home-hub__welcome p { font-size: 12px; }
  .home-hub__scroll { padding: 16px; }
  .home-hub__guides { grid-template-columns: 1fr; }
}
</style>
