export class RateLimiter {
  private requests: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    
    // Remove requests outside the window
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.windowMs
    );

    // Check if we've hit the limit
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return this.acquire(); // Retry after waiting
      }
    }

    this.requests.push(now);
  }

  getStats(): { current: number; max: number; window_ms: number } {
    const now = Date.now();
    this.requests = this.requests.filter(
      timestamp => now - timestamp < this.windowMs
    );
    
    return {
      current: this.requests.length,
      max: this.maxRequests,
      window_ms: this.windowMs,
    };
  }
}
