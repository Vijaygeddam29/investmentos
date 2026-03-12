/**
 * FMP API client with rate limiting (max 3 concurrent, 250ms minimum gap).
 * Includes a circuit-breaker: once the daily quota is hit, all subsequent
 * calls fail immediately without burning retry time.
 */

const FMP_BASE = "https://financialmodelingprep.com/stable";

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Circuit breaker ─────────────────────────────────────────────────────────
// Set to true once FMP signals quota exhaustion; resets after 1 hour.
let quotaExhausted = false;
let quotaExhaustedAt = 0;
const QUOTA_RESET_MS = 60 * 60 * 1000; // try again after 1 hour

function markQuotaExhausted() {
  if (!quotaExhausted) {
    console.warn("[FMP] Daily quota exhausted — skipping all FMP calls until reset");
    quotaExhausted = true;
    quotaExhaustedAt = Date.now();
  }
}

function isQuotaExhausted(): boolean {
  if (!quotaExhausted) return false;
  if (Date.now() - quotaExhaustedAt > QUOTA_RESET_MS) {
    quotaExhausted = false;
    console.log("[FMP] Quota circuit breaker reset — retrying FMP calls");
    return false;
  }
  return true;
}

class FmpRateLimiter {
  private queue: Array<() => Promise<void>> = [];
  private running = 0;
  private readonly maxConcurrent = 3;
  private readonly minDelayMs = 250;
  private lastRequestAt = 0;

  schedule<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push(async () => {
        const now = Date.now();
        const gap = now - this.lastRequestAt;
        if (gap < this.minDelayMs) await sleep(this.minDelayMs - gap);
        this.lastRequestAt = Date.now();
        try {
          resolve(await fn());
        } catch (err) {
          reject(err);
        }
      });
      this.drain();
    });
  }

  private drain() {
    if (this.running >= this.maxConcurrent) return;
    const task = this.queue.shift();
    if (!task) return;
    this.running++;
    task().finally(() => {
      this.running--;
      this.drain();
    });
  }
}

const limiter = new FmpRateLimiter();

export async function fmpFetch(
  endpoint: string,
  params: Record<string, string> = {},
  retries = 3,
): Promise<any> {
  if (isQuotaExhausted()) {
    throw new Error("FMP daily quota exhausted — try again after quota resets");
  }

  return limiter.schedule(async () => {
    const key = process.env.FMP_API_KEY || "";
    const query = new URLSearchParams({ ...params, apikey: key });
    const url = `${FMP_BASE}/${endpoint}?${query}`;

    for (let attempt = 1; attempt <= retries; attempt++) {
      const res = await fetch(url);
      if (res.status === 429) {
        // First 429 might be per-minute rate limit; after 2 retries treat as quota exhaustion
        if (attempt >= 2) {
          markQuotaExhausted();
          throw new Error("FMP daily quota exhausted");
        }
        console.warn(`[FMP] Rate limited on ${endpoint}, waiting ${attempt * 1000}ms...`);
        await sleep(attempt * 1000);
        continue;
      }
      if (!res.ok) {
        throw new Error(`FMP ${res.status} on ${endpoint}: ${res.statusText}`);
      }
      const data = await res.json();
      // Detect FMP quota/error response payloads (returned as 200 with error body)
      if (!Array.isArray(data)) {
        const msg = data?.["Error Message"] ?? data?.message ?? "";
        if (typeof msg === "string" && msg.length > 0) {
          if (msg.toLowerCase().includes("limit") || msg.toLowerCase().includes("upgrade")) {
            markQuotaExhausted();
          }
          throw new Error(`FMP error on ${endpoint}: ${msg}`);
        }
      }
      return Array.isArray(data) ? data : (data?.data ?? []);
    }
    throw new Error(`FMP ${endpoint} failed after ${retries} retries`);
  });
}
