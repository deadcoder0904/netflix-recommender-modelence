type QueueTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
};

export function createLimiter(concurrency: number, minDelayMs: number) {
  let active = 0;
  let lastStart = 0;
  const queue: QueueTask<unknown>[] = [];

  const drain = () => {
    if (active >= concurrency) return;
    const next = queue.shift() as QueueTask<unknown> | undefined;
    if (!next) return;

    const wait = Math.max(0, minDelayMs - (Date.now() - lastStart));
    const start = () => {
      active += 1;
      lastStart = Date.now();
      next
        .run()
        .then(next.resolve)
        .catch(next.reject)
        .finally(() => {
          active -= 1;
          drain();
        });
    };

    if (wait > 0) {
      setTimeout(start, wait);
    } else {
      start();
    }
  };

  const enqueue = <T>(run: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      queue.push({ run, resolve, reject } as QueueTask<unknown>);
      drain();
    });

  return { enqueue };
}

export const posterQueue = createLimiter(3, 200);
