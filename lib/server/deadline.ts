export class DeadlineError extends Error {
    constructor(public readonly code: string, message: string) {
        super(message);
        this.name = 'DeadlineError';
    }
}

/** Also observes late rejections, so a timed-out task cannot crash the process. */
export async function withinDeadline<T>(task: PromiseLike<T>, milliseconds: number, error: DeadlineError, onTimeout?: () => void): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            Promise.resolve(task),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                    reject(error);
                    onTimeout?.();
                }, milliseconds);
            }),
        ]);
    } finally {
        clearTimeout(timer);
    }
}
