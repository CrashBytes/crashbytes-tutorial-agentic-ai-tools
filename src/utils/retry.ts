export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry?: (error: any) => boolean;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Check if we should retry this error
      if (config.shouldRetry && !config.shouldRetry(error)) {
        throw error;
      }

      // Don't wait after the last attempt
      if (attempt === config.maxAttempts) {
        break;
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        config.baseDelayMs * Math.pow(2, attempt - 1),
        config.maxDelayMs
      );
      const jitter = Math.random() * 0.3 * delay; // 30% jitter
      
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  
  throw lastError;
}

export function isRetryableError(error: any): boolean {
  // Retry on network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
    return true;
  }

  // Retry on 429 (rate limit) and 5xx errors
  if (error.status === 429 || (error.status >= 500 && error.status < 600)) {
    return true;
  }

  return false;
}
