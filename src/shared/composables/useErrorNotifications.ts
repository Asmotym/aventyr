import { watch } from 'vue';
import { notifications } from '@/shared/services/notifications.service';

type ErrorMessage = string | readonly string[] | null | undefined | false;

/** Observe errors once at their owner; keep error state for retry/validation logic. */
export function useErrorNotifications(...sources: Array<() => ErrorMessage>) {
  const normalize = (value: ErrorMessage) => [...new Set(
    (Array.isArray(value) ? value : [value]).filter((item): item is string => typeof item === 'string' && item.trim().length > 0),
  )].join('\n');
  let ownedNotificationId: number | undefined;
  return watch(() => sources.map(source => normalize(source())), (messages, previous = []) => {
    const changed = [...new Set(messages.filter((message, index) => message && message !== previous[index]))];
    if (changed.length) {
      notifications.error(changed.join('\n'), 6000);
      ownedNotificationId = notifications.current.value?.id;
    } else if (ownedNotificationId !== undefined && !messages.some(Boolean) && notifications.current.value?.id === ownedNotificationId) {
      notifications.close();
      ownedNotificationId = undefined;
    }
  }, { immediate: true, flush: 'sync' });
}
