/** fetch with timeout — AbortSignal.timeout is not available in all browsers. */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const { timeoutMs = 15_000, signal: externalSignal, ...rest } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }

  return fetch(input, { ...rest, signal: controller.signal }).finally(() => {
    clearTimeout(timeoutId);
  });
}
