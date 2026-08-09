export interface RetryResult<T> {
  result: T;
  attempts: number;
}

/**
 * Runs fn with retries (exponential backoff, jittered). maxAttempts=2 means
 * "one retry on failure", matching the assignment's "at least one retry on
 * failure" requirement for llm_call/http_request.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  maxAttempts = 2,
  baseDelayMs = 500
): Promise<RetryResult<T>> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn(attempt);
      return { result, attempts: attempt };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * 200;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}
