export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (err: unknown) => boolean;
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof TypeError && (err.message.includes("fetch") || err.message.includes("network"))) return true;
  if (err instanceof Error) {
    if (err.name === "TimeoutError" || err.name === "AbortError") return true;
    if (/ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|socket hang up/i.test(err.message)) return true;
    if (/upstream\s+(500|502|503|504|429|407)/i.test(err.message)) return true;
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    attempts = 3,
    baseDelayMs = 300,
    maxDelayMs = 5_000,
    shouldRetry = isRetryableError,
  } = opts;

  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt === attempts - 1) break;
      if (!shouldRetry(err)) break;

      const jitter = Math.random() * 200;
      const delay = Math.min(baseDelayMs * 2 ** attempt + jitter, maxDelayMs);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}
