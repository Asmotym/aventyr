import { reactive } from 'vue';
import type { AppLocale } from 'netlify/core/types/locale.types';

interface LocaleSyncDependencies {
  getUserId(): string | undefined;
  getStoredLocale(): AppLocale | null;
  detectLocale(): AppLocale;
  applyLocale(locale: AppLocale): void;
  saveLocale(userId: string, locale: AppLocale): Promise<unknown>;
  updateUser(locale: AppLocale): void;
}

// Keep request ordering and reconciliation separate from the i18n/UI integration.
export function createLocaleSync(deps: LocaleSyncDependencies) {
  const state = reactive({
    choice: null as { current: AppLocale; detected: AppLocale } | null,
    saving: false,
    error: false,
  });
  let revision = 0;
  let manualUserId: string | undefined;
  let writes: Promise<unknown> = Promise.resolve();

  function reset() {
    revision += 1;
    manualUserId = undefined;
    state.choice = null;
    state.saving = false;
    state.error = false;
  }

  async function persist(userId: string, locale: AppLocale, requestRevision: number) {
    const active = () => revision === requestRevision && deps.getUserId() === userId;
    // Serialize writes so an older in-flight PATCH cannot overwrite a newer choice.
    const write = writes.catch(() => {}).then(async () => {
      if (!active()) return;
      await deps.saveLocale(userId, locale);
      if (active()) deps.updateUser(locale);
    });
    writes = write;
    await write;
    return active();
  }

  async function reconcile(userId: string, locale: AppLocale | null) {
    if (deps.getUserId() !== userId || manualUserId === userId) return;
    const requestRevision = ++revision;
    state.choice = null;
    state.error = false;
    state.saving = false;
    if (locale !== null) {
      deps.applyLocale(locale);
      return;
    }
    const current = deps.getStoredLocale();
    const detected = deps.detectLocale();
    if (current && current !== detected) {
      state.choice = { current, detected };
      return;
    }
    deps.applyLocale(detected);
    try {
      await persist(userId, detected, requestRevision);
    } catch {
      if (revision !== requestRevision || deps.getUserId() !== userId) return;
      // An automatic save failure also needs a visible way to retry.
      state.choice = { current: current ?? detected, detected };
      state.error = true;
    }
  }

  async function select(locale: AppLocale, fromPrompt = false) {
    const userId = deps.getUserId();
    const requestRevision = ++revision;
    if (!fromPrompt) {
      manualUserId = userId;
      state.choice = null;
    }
    state.error = false;
    state.saving = true;
    deps.applyLocale(locale);
    try {
      if (userId && !await persist(userId, locale, requestRevision)) return;
      if (revision === requestRevision) state.choice = null;
    } catch (error) {
      if (revision !== requestRevision || deps.getUserId() !== userId) return;
      if (fromPrompt) state.error = true;
      else throw error;
    } finally {
      if (revision === requestRevision) state.saving = false;
    }
  }

  return { state, reconcile, select, reset };
}
