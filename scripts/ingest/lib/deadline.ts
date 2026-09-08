/** Bound a read-only source group so it cannot hold up storing other sources. */
export async function collectionDeadline<T>(
  load: Promise<T>,
  fallback: T,
  milliseconds: number
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      load,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          console.warn(
            "[metrics] source collection deadline reached; storing other available sources"
          );
          resolve(fallback);
        }, milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
