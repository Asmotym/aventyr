<template>
    <HeaderComponent />
    <v-container
      v-if="userLoggedIn"
      class="py-6 home__container"
      :class="{ 'home__container--dashboard': isConnectedDashboard, 'home__container--room': !isConnectedDashboard }"
    >
        <v-row v-if="isConnectedDashboard" class="home__dashboard" align="stretch">
          <v-col v-if="!smAndDown" cols="12" md="4" class="home__dashboard-column">
            <RoomsBoard dashboard />
          </v-col>
          <v-col cols="12" md="8" class="home__dashboard-column home__dashboard-scroll-column">
            <v-btn v-if="smAndDown" class="home__mobile-rooms-trigger" color="primary" variant="tonal" prepend-icon="mdi-dice-multiple-outline" :aria-label="t('home.openRooms')" :aria-expanded="mobileRoomsOpen" aria-haspopup="dialog" @click="mobileRoomsOpen = true">
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
    <v-container v-else class="home__logged-out-home py-8">
      <div class="d-flex justify-center align-center home__login-panel">
        <v-card
          :title="t('home.not_logged_in_title')"
          :subtitle="t('home.not_logged_in_message')"
        >
        <!-- Prepend Aventyr icon -->
        <template v-slot:prepend>
          <img
            src="/aventyr-d100.svg"
            :alt="t('common.logoAlt')"
            class="app-header__logo"
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

<style scoped lang="scss" src="@/assets/styles/features/home/home.scss"></style>
