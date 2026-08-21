<template>
    <HeaderComponent />
    <v-container
      v-if="userLoggedIn"
      class="py-6 home-container"
      :class="{ 'home-container--dashboard': isConnectedDashboard }"
    >
        <v-row v-if="isConnectedDashboard" class="home-dashboard" align="stretch">
          <v-col cols="12" md="4" class="dashboard-column">
            <RoomsBoard dashboard />
          </v-col>
          <v-col cols="12" md="8" class="dashboard-column dashboard-scroll-column">
            <section class="welcome-panel mb-6">
              <h1 class="text-h4 mb-2">{{ t('home.connectedWelcome', { name: currentUser?.username ?? t('common.someone') }) }}</h1>
              <p class="text-body-1 text-medium-emphasis mb-4">{{ t('home.connectedIntro') }}</p>
              <v-row dense>
                <v-col cols="12" md="6">
                  <v-card variant="tonal" class="tutorial-card">
                    <v-card-title>{{ t('home.tutorial.createTitle') }}</v-card-title>
                    <v-card-text>{{ t('home.tutorial.createText') }}</v-card-text>
                  </v-card>
                </v-col>
                <v-col cols="12" md="6">
                  <v-card variant="tonal" class="tutorial-card">
                    <v-card-title>{{ t('home.tutorial.joinTitle') }}</v-card-title>
                    <v-card-text>{{ t('home.tutorial.joinText') }}</v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </section>
            <NewsSection :limit="3" />
          </v-col>
        </v-row>
        <RoomsBoard v-else />
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
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import HeaderComponent from 'core/components/Header.component.vue';
import RoomsBoard from 'core/components/rooms/RoomsBoard.component.vue';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import DiscordAuth from 'modules/discord-auth/components/DiscordAuth.vue';
import NewsSection from 'core/components/articles/NewsSection.component.vue';

const { t } = useI18n();
const route = useRoute();

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

.home-dashboard {
  height: calc(100vh - var(--v-layout-top) - var(--v-layout-bottom) - 48px);
  min-height: 0;
}

.dashboard-column {
  min-height: 0;
  height: 100%;
}

.dashboard-scroll-column {
  overflow-y: auto;
  padding-right: 8px;
}

.welcome-panel {
  width: 100%;
}

.tutorial-card {
  border-radius: 8px;
  height: 100%;
}

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
    height: auto;
  }

  .dashboard-scroll-column {
    overflow-y: visible;
    padding-right: 12px;
  }
}
</style>
