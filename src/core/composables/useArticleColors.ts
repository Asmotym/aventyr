import { computed, reactive, ref, watch } from 'vue';
import { DiscordService } from 'modules/discord-auth/services/discord.service';
import { apiRequest } from 'core/services/api.service';
import { normalizeColorHistory, rememberArticleColor, type ArticleColorHistory } from 'netlify/core/articles/colors';

const histories = reactive<Record<string, ArticleColorHistory>>({});
const pending = new Map<string, Promise<void>>();
const saves = new Map<string, Promise<void>>();
const revisions = new Map<string, number>();
export function useArticleColors() {
  const userId = computed(() => DiscordService.getInstance().user.value?.id);
  const error = ref(false);
  const history = computed(() => userId.value ? histories[userId.value] ?? { recent: [], custom: [] } : { recent: [], custom: [] });
  async function load(id: string) {
    if (histories[id]) return;
    if (!pending.has(id)) {
      const revision = revisions.get(id) ?? 0;
      pending.set(id, apiRequest<ArticleColorHistory>(`/users/${encodeURIComponent(id)}/editor-colors`).then(value => {
        if ((revisions.get(id) ?? 0) === revision) histories[id] = normalizeColorHistory(value);
      }).finally(() => { pending.delete(id); }));
    }
    try { await pending.get(id); } catch { error.value = true; }
  }
  watch(userId, id => { error.value = false; if (id) void load(id); }, { immediate: true });
  function remember(color: string) {
    const id = userId.value;
    if (!id) return;
    error.value = false;
    const revision = (revisions.get(id) ?? 0) + 1;
    revisions.set(id, revision);
    histories[id] = rememberArticleColor(histories[id] ?? { recent: [], custom: [] }, color);
    const request = (saves.get(id) ?? Promise.resolve()).then(async () => {
      const value = await apiRequest<ArticleColorHistory>(`/users/${encodeURIComponent(id)}/editor-colors`, { method: 'POST', body: JSON.stringify({ color }) });
      if (revisions.get(id) === revision) histories[id] = normalizeColorHistory(value);
    });
    saves.set(id, request.catch(() => { if (userId.value === id) error.value = true; }));
  }
  return { history, error, remember };
}
