import { withDeadline } from "@shared/requestDeadline";

/** Include stalled response bodies and preserve React Query cancellation. */
export async function queryFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const parent = init?.signal ?? (typeof Request !== "undefined" && input instanceof Request ? input.signal : undefined);
  const abort = () => controller.abort(parent?.reason);
  if (parent?.aborted) abort();
  else parent?.addEventListener("abort", abort, { once: true });
  try {
    return await withDeadline(async (deadline) => {
      const timeout = () => controller.abort(deadline.reason);
      deadline.addEventListener("abort", timeout, { once: true });
      try {
        const response = await fetch(input, { ...init, credentials: "include", signal: controller.signal });
        const body = await response.arrayBuffer();
        return new Response(response.status === 204 || response.status === 205 || response.status === 304 ? null : body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } finally {
        deadline.removeEventListener("abort", timeout);
      }
    }, 20_000);
  } finally {
    parent?.removeEventListener("abort", abort);
  }
}
