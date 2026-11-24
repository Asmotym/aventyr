import { onScopeDispose, ref, watch } from 'vue';

/** Own a blob URL for a reactive request, ignoring obsolete or disposed reads. */
export function useObjectUrl(request: () => Promise<Blob> | null) {
  const url = ref('');
  let generation = 0;
  function clear() {
    if (url.value) URL.revokeObjectURL(url.value);
    url.value = '';
  }
  watch(request, async pending => {
    const current = ++generation;
    clear();
    if (!pending) return;
    try {
      const blob = await pending;
      if (current === generation) url.value = URL.createObjectURL(blob);
    } catch {
      // Optional images retain their caller's fallback after failed reads.
    }
  }, { immediate: true });
  onScopeDispose(() => { generation++; clear(); });
  return url;
}
