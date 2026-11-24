import { readonly, ref } from 'vue';

export type NotificationType = 'success' | 'info' | 'warning' | 'error';

export interface AppNotification {
  id: number;
  message: string;
  type: NotificationType;
  timeout: number;
}

const current = ref<AppNotification | null>(null);
let nextId = 1;
const pending: Array<{ message: string; type: NotificationType; timeout: number }> = [];

function show(message: string, type: NotificationType = 'info', timeout = 3500) {
  current.value = {
    id: nextId,
    message,
    type,
    timeout,
  };
  nextId += 1;
}

export const notifications = {
  current: readonly(current),
  enqueue(message: string, type: NotificationType = 'info', timeout = 3500) { if (current.value) pending.push({ message, type, timeout }); else show(message, type, timeout); },
  show,
  success(message: string, timeout?: number) {
    show(message, 'success', timeout);
  },
  info(message: string, timeout?: number) {
    show(message, 'info', timeout);
  },
  warning(message: string, timeout?: number) {
    show(message, 'warning', timeout);
  },
  error(message: string, timeout?: number) {
    show(message, 'error', timeout);
  },
  close() {
    const next = pending.shift();
    if (next !== undefined) show(next.message, next.type, next.timeout); else current.value = null;
  },
};
