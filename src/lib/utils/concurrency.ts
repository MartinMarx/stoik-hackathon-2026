export async function withConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await fn(items[currentIndex]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);

  return results;
}

export class TimeoutError extends Error {
  constructor(ms: number, label?: string) {
    super(`${label ?? "Operation"} timed out after ${(ms / 1000).toFixed(0)}s`);
    this.name = "TimeoutError";
  }
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label?: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms, label)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function isRateLimitError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { status?: number; error?: { type?: string } };
  return e.status === 429 || e.error?.type === "rate_limit_error";
}

function getRetryAfterMs(err: unknown): number | null {
  if (typeof err !== "object" || err === null) return null;
  const headers = (err as { headers?: Record<string, string> }).headers;
  const val = headers?.["retry-after"];
  if (!val) return null;
  const secs = Number(val);
  return Number.isFinite(secs) ? secs * 1000 : null;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelayMs = 5_000,
  label?: string,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const retryable = err instanceof TimeoutError || isRateLimitError(err);
      if (!retryable || attempt >= maxRetries) throw err;

      const retryAfter = getRetryAfterMs(err);
      const delay = retryAfter ?? baseDelayMs * 2 ** attempt;
      console.warn(
        `[withRetry] ${label ?? "call"} attempt ${attempt + 1} failed, retrying in ${(delay / 1000).toFixed(1)}s: ${err instanceof Error ? err.message : err}`,
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}
