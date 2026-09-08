export const ASK_SERVER_TIMEOUT_MS = 55_000;
export const ASK_CLIENT_TIMEOUT_MS = 65_000;

export class DeadlineError extends Error {
  constructor() {
    super("This request took too long. Please try again.");
    this.name = "DeadlineError";
  }
}

/** Bounds the whole operation, including stalled retrieval or response bodies. */
export async function withDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  milliseconds: number
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new DeadlineError();
      reject(error);
      controller.abort(error);
    }, milliseconds);
  });
  try {
    return await Promise.race([work(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}
