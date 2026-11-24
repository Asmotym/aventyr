import { cleanupArticleImages } from '../features/articles/article-images.service';
import { cleanupBagImages } from '../features/rooms/bags/room-bag-images.service';
import { publishRoomEvent } from '../features/rooms/realtime/room-realtime.publisher';
import { expireInactiveSessions } from '../features/rooms/sessions/room-sessions.service';
import { createLogger } from '../infrastructure/logging/logger';
const logger = createLogger('BackgroundJobs');
const defaults = { cleanupArticleImages, cleanupBagImages, expireInactiveSessions, publishRoomEvent };
export interface JobClock {
    every(callback: () => void, interval: number): () => void;
}
const clock: JobClock = {
    every(callback, interval) {
        const timer = setInterval(callback, interval);
        timer.unref();
        return () => clearInterval(timer);
    },
};
/** Jobs start only after startup succeeds. Never overlap one job's executions. */
export function startBackgroundJobs(overrides: Partial<typeof defaults> = {}, jobClock = clock) {
    const tasks = { ...defaults, ...overrides };
    const pending = new Set<Promise<void>>();
    const cancel: Array<() => void> = [];
    let stopped = false;
    function schedule(name: string, interval: number, run: () => Promise<unknown>) {
        let running = false;
        cancel.push(jobClock.every(() => {
            if (stopped || running)
                return;
            running = true;
            const execution = Promise.resolve().then(run).then(() => { }, error => {
                logger.warn(name + ' failed', { error: error instanceof Error ? error.message : 'UnknownError' });
            }).finally(() => {
                running = false;
                pending.delete(execution);
            });
            pending.add(execution);
        }, interval));
    }
    schedule('Article image cleanup', 60 * 60 * 1000, tasks.cleanupArticleImages);
    schedule('Bag image cleanup', 60 * 60 * 1000, tasks.cleanupBagImages);
    schedule('Session expiry', 30000, async () => {
        for (const session of await tasks.expireInactiveSessions()) {
            tasks.publishRoomEvent(session.roomId, { type: 'session.closed', session });
        }
    });
    return async function stop() {
        stopped = true;
        for (const stopTimer of cancel)
            stopTimer();
        await Promise.all(pending);
    };
}
