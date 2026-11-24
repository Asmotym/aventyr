<template>
  <section class="api-settings-panel">
    <header class="api-hero"><span class="api-hero__icon"><v-icon icon="mdi-code-braces" size="28" /></span><div><h2>{{ t('settings.tabs.api') }}</h2><p>{{ t('settings.api.description') }}</p></div></header>

    <v-alert
      v-if="feedback && feedback.type === 'success'"
      type="success"
      variant="tonal"
      class="mb-4"
    >
      {{ feedback.message }}
    </v-alert>

    <div v-if="loadingKey" class="d-flex justify-center pa-6">
      <v-progress-circular color="primary" indeterminate />
    </div>

    <div v-else>
      <section class="api-credentials">
      <div class="credentials-heading"><span class="credentials-heading__icon"><v-icon icon="mdi-key-outline" size="22" /></span><h3>{{ t('settings.design.keyTitle') }}</h3><v-chip :color="apiKey ? 'primary' : undefined" size="small" variant="tonal" :prepend-icon="apiKey ? 'mdi-check-circle-outline' : 'mdi-minus-circle-outline'">{{ t(apiKey ? 'settings.design.keyReady' : 'settings.design.keyEmpty') }}</v-chip></div>
      <v-text-field
        variant="outlined"
        :model-value="apiKey ?? ''"
        :type="showKey ? 'text' : 'password'"
        :label="t('settings.api.apiKeyLabel')"
        :placeholder="!apiKey ? t('settings.api.emptyPlaceholder') : ''"
        readonly
        hide-details="auto"
        class="mb-2"
      >
        <template #append-inner>
          <v-btn
            v-if="apiKey"
            variant="text"
            :icon="showKey ? 'mdi-eye-off' : 'mdi-eye'"
            :title="showKey ? t('settings.api.hide') : t('settings.api.show')"
            :aria-label="showKey ? t('settings.api.hide') : t('settings.api.show')"
            @click="toggleVisibility"
            size="small"
          />
          <v-btn
            v-if="apiKey"
            variant="text"
            icon="mdi-content-copy"
            color="primary"
            :disabled="copying"
            :title="t('settings.api.copy')"
            :aria-label="t('settings.api.copy')"
            @click="copyKey"
            size="small"
          />
        </template>
      </v-text-field>

      <p v-if="!apiKey" class="text-body-2 text-medium-emphasis mb-4">
        {{ t('settings.api.emptyState') }}
      </p>
      <p v-else class="text-caption text-medium-emphasis mb-4">
        <span v-if="createdAt">
          {{ t('settings.api.generatedAt', { date: formatDate(createdAt) }) }}
        </span>
        <span v-if="lastUsedAt" class="ms-2">
          {{ t('settings.api.lastUsed', { date: formatDate(lastUsedAt) }) }}
        </span>
      </p>

      <div class="d-flex flex-wrap gap-3">
        <v-btn
          color="primary"
          variant="flat"
          prepend-icon="mdi-key-plus"
          :loading="generating"
          :disabled="!currentUser || generating"
          @click="generateKey"
        >
          {{ apiKey ? t('settings.api.regenerate') : t('settings.api.generate') }}
        </v-btn>
        <v-btn
          v-if="apiKey"
          color="error"
          variant="text"
          prepend-icon="mdi-key-remove-outline"
          :loading="revoking"
          :disabled="revoking"
          @click="revokeKey"
        >
          {{ t('settings.api.revoke') }}
        </v-btn>
      </div>

      </section>

      <section class="api-launcher">
        <div class="launcher-header">
          <div>
            <h3 class="text-h6 mb-1"><v-icon icon="mdi-book-open-page-variant-outline" size="22" class="mr-2" color="primary" />{{ t('settings.api.docs.title') }}</h3>
            <p class="text-body-2 text-medium-emphasis mb-0">
              {{ t('settings.api.docs.description') }}
            </p>
          </div>
          <v-btn
            color="primary"
            variant="flat"
            prepend-icon="mdi-open-in-new"
            :href="docsUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ t('settings.api.docs.open') }}
          </v-btn>
        </div>

        <div class="docs-grid mt-5">
          <div class="docs-panel">
            <div class="text-subtitle-2 mb-2">{{ t('settings.api.docs.baseUrl') }}</div>
            <code class="api-inline-code">{{ apiBaseUrl }}</code>
          </div>

          <div class="docs-panel">
            <div class="text-subtitle-2 mb-2">{{ t('settings.api.docs.headers') }}</div>
            <pre class="api-code-block">{{ headersExample }}</pre>
          </div>

          <div class="docs-panel getting-started">
            <div class="text-subtitle-2 mb-3">{{ t('settings.api.docs.gettingStarted') }}</div>
            <ol class="setup-list">
              <li>{{ t('settings.api.docs.stepGenerate') }}</li>
              <li>{{ t('settings.api.docs.stepCopy') }}</li>
              <li>{{ t('settings.api.docs.stepOpenDocs') }}</li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useErrorNotifications } from '@/shared/composables/useErrorNotifications';
import { copyText } from '@/shared/utils/clipboard';
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { DiscordService } from '@/features/auth';
import { ApiKeysService, type UserApiKeyData } from '@/features/settings/services/api-keys.service';

type FeedbackState = { type: 'success' | 'error'; message: string } | null;

const { t } = useI18n();
const discordService = DiscordService.getInstance();
const currentUser = computed(() => discordService.user.value);

const apiKey = ref<string | null>(null);
const createdAt = ref<string | null>(null);
const lastUsedAt = ref<string | null>(null);
const showKey = ref(false);
const loadingKey = ref(false);
const generating = ref(false);
const revoking = ref(false);
const copying = ref(false);
const feedback = ref<FeedbackState>(null);
const docsUrl = import.meta.env.VITE_API_DOCS_URL || 'https://docs.aventyr.io';
const apiBaseUrl = import.meta.env.VITE_PUBLIC_API_BASE_URL || 'https://api.aventyr.io/api';
const headersExample = `Accept: application/json
X-API-Key: <your-api-key>`;

function setKeyData(data: UserApiKeyData) {
  apiKey.value = data.apiKey;
  createdAt.value = data.createdAt ?? null;
  lastUsedAt.value = data.lastUsedAt ?? null;
}

function resetState() {
  apiKey.value = null;
  createdAt.value = null;
  lastUsedAt.value = null;
  showKey.value = false;
}

async function loadApiKey() {
  if (!currentUser.value) {
    resetState();
    return;
  }

  loadingKey.value = true;
  feedback.value = null;
  try {
    const data = await ApiKeysService.fetch(currentUser.value.id);
    setKeyData(data);
  } catch (error) {
    feedback.value = {
      type: 'error',
      message: error instanceof Error ? error.message : t('settings.api.loadError'),
    };
  } finally {
    loadingKey.value = false;
  }
}

async function generateKey() {
  if (!currentUser.value) return;

  generating.value = true;
  feedback.value = null;
  try {
    const data = await ApiKeysService.generate(currentUser.value.id);
    setKeyData(data);
    showKey.value = true;
    feedback.value = {
      type: 'success',
      message: t('settings.api.generateSuccess'),
    };
  } catch (error) {
    feedback.value = {
      type: 'error',
      message: error instanceof Error ? error.message : t('settings.api.generateError'),
    };
  } finally {
    generating.value = false;
  }
}

async function revokeKey() {
  if (!currentUser.value || !apiKey.value) return;
  if (!window.confirm(t('settings.api.confirmRevoke'))) return;

  revoking.value = true;
  feedback.value = null;
  try {
    await ApiKeysService.revoke(currentUser.value.id);
    resetState();
    feedback.value = {
      type: 'success',
      message: t('settings.api.revokeSuccess'),
    };
  } catch (error) {
    feedback.value = {
      type: 'error',
      message: error instanceof Error ? error.message : t('settings.api.revokeError'),
    };
  } finally {
    revoking.value = false;
  }
}

async function copyKey() {
  if (!apiKey.value) return;
  copying.value = true;
  try {
    await copyText(apiKey.value);
    feedback.value = { type: 'success', message: t('settings.api.copySuccess') };
  } catch {
    feedback.value = { type: 'error', message: t('settings.api.copyError') };
  } finally {
    copying.value = false;
  }
}

function toggleVisibility() {
  showKey.value = !showKey.value;
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

watch(
  () => currentUser.value?.id,
  (userId) => {
    if (userId) {
      loadApiKey();
    } else {
      resetState();
    }
  },
  { immediate: true }
);

useErrorNotifications(
  () => feedback.value && feedback.value.type === 'error' ? feedback.value.message : null,
);
</script>

<style scoped>
.api-settings-panel { width: 100%; }
.api-hero { display: flex; align-items: center; gap: 16px; padding: 22px; margin-bottom: 20px; border: 1px solid rgba(var(--v-theme-primary), .16); border-radius: 16px; background: linear-gradient(120deg, rgba(var(--v-theme-primary), .055), transparent), rgb(var(--v-theme-surface)); }
.api-hero__icon { display: grid; place-items: center; width: 52px; height: 52px; flex-shrink: 0; border-radius: 16px; color: rgb(var(--v-theme-primary)); background: rgba(var(--v-theme-primary), .09); }
.api-hero h2 { font-size: 20px; letter-spacing: -.025em; margin-bottom: 4px; }
.api-hero p { font-size: 13px; line-height: 1.6; color: rgba(var(--v-theme-on-surface), .6); }
.api-credentials, .api-launcher { min-width: 0; padding: 24px; border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity)); border-radius: 16px; background: rgb(var(--v-theme-surface)); }
.api-launcher { margin-top: 20px; }
.credentials-heading { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 24px; }
.credentials-heading h3 { font-size: 16px; font-weight: 700; margin-right: auto; }
.credentials-heading__icon { display: grid; place-items: center; width: 38px; height: 38px; border-radius: 12px; background: rgba(var(--v-theme-primary), .08); color: rgb(var(--v-theme-primary)); }
.api-credentials :deep(input) { font-family: monospace; font-size: 13px; }
.launcher-header h3 { display: flex; align-items: center; font-size: 16px !important; font-weight: 700; }
.launcher-header p { font-size: 12px !important; line-height: 1.7; }

.gap-3 {
  gap: 12px;
}

.api-code-block {
  display: block;
  width: 100%;
  padding: 12px;
  background: rgba(var(--v-theme-surface-variant), 0.4);
  border-radius: 10px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.85rem;
  line-height: 1.4;
  overflow-x: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.api-inline-code {
  display: block;
  overflow-wrap: anywhere;
  padding: 10px 12px;
  background: rgba(var(--v-theme-surface-variant), 0.6);
  border-radius: 4px;
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 0.85rem;
}

.launcher-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.docs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
  gap: 16px;
}

.docs-panel {
  padding: 16px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 12px;
  background: rgba(var(--v-theme-on-surface), .02);
}

.getting-started {
  grid-column: 1 / -1;
}

.setup-list {
  margin: 0;
  padding-left: 24px;
  font-size: 13px;
  line-height: 1.8;
  color: rgba(var(--v-theme-on-surface), 0.82);
}

.setup-list li + li {
  margin-top: 8px;
}

@media (max-width: 600px) {
  .api-credentials, .api-launcher, .api-hero { padding: 18px; }
  .launcher-header {
    flex-direction: column;
  }
}
</style>
