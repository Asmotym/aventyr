/** Serializes local sends. Cancelling invalidates queued work before it can send. */
export class SessionStartCancelledError extends Error {
    constructor() { super('Session start cancelled'); }
}

export class SessionActivityQueue {
    private tail: Promise<unknown> = Promise.resolve();
    private generation = 0;

    cancel(): void { this.generation += 1; }

    enqueue<T>(operation: (checkCancelled: () => void) => Promise<T>): Promise<T> {
        const generation = this.generation;
        const checkCancelled = () => {
            if (generation !== this.generation) throw new SessionStartCancelledError();
        };
        const result = this.tail.then(async () => {
            checkCancelled();
            return operation(checkCancelled);
        });
        this.tail = result.catch(() => undefined);
        return result;
    }
}
