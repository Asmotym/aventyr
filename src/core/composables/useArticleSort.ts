import { onScopeDispose, ref, watch } from 'vue';
import { isArticleSort, type ArticleSort } from 'netlify/core/types/data.types';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { fetchUserPreferences, saveUserPreferences } from 'core/services/preferences.service';

export function useArticleSort() {
  const sort = ref<ArticleSort>('newest');
  const syncFailed = ref(false);
  const discord = DiscordService.getInstance();
  let epoch = 0;
  let revision = 0;
  let applying = false;
  let writes: Promise<unknown> = Promise.resolve();
  const key = (id?: string) => `aventyr_article_sort:${id ?? 'guest'}`;
  function cached(id?: string): ArticleSort {
    try { const value = localStorage.getItem(key(id)); return isArticleSort(value) ? value : 'newest'; }
    catch { return 'newest'; }
  }
  function cache(id: string | undefined, value: ArticleSort) {
    try { localStorage.setItem(key(id), value); } catch { /* Browsing works when storage is unavailable. */ }
  }
  watch(() => discord.user.value?.id, async id => {
    const request = ++epoch;
    const startRevision = ++revision;
    applying = true; sort.value = cached(id); applying = false; syncFailed.value = false;
    if (!id) return;
    try {
      // Finish pending local writes before reading the account preference.
      await writes;
      const preferences = await fetchUserPreferences(id);
      if (request !== epoch || startRevision !== revision) return;
      const value = isArticleSort(preferences.articleSort) ? preferences.articleSort : 'newest';
      applying = true; sort.value = value; applying = false; cache(id, value);
    } catch { if (request === epoch && startRevision === revision) syncFailed.value = true; }
  }, { immediate: true, flush: 'sync' });
  watch(sort, value => {
    if (applying) return;
    const currentRevision = ++revision;
    const request = epoch;
    const id = discord.user.value?.id;
    cache(id, value); syncFailed.value = false;
    if (!id) return;
    writes = writes.catch(() => {}).then(() => saveUserPreferences(id, { articleSort: value })).then(() => {
      if (request === epoch && currentRevision === revision) syncFailed.value = false;
    }).catch(() => { if (request === epoch && currentRevision === revision) syncFailed.value = true; });
  }, { flush: 'sync' });
  onScopeDispose(() => { epoch++; });
  return { sort, syncFailed };
}
