/**
 * In-memory sliding window rate limiter.
 * 100 requests per minute per API key.
 */

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100;

// Map of API key hash -> array of request timestamps
const windows = new Map<string, number[]>();

// Clean stale entries periodically
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of windows.entries()) {
        const valid = timestamps.filter(t => now - t < WINDOW_MS);
        if (valid.length === 0) {
            windows.delete(key);
        } else {
            windows.set(key, valid);
        }
    }
}, 60_000);

export interface RateLimitResult {
    allowed: boolean;
    limit: number;
    remaining: number;
    resetMs: number;
}

export function checkRateLimit(identifier: string): RateLimitResult {
    const now = Date.now();
    const timestamps = windows.get(identifier) || [];

    // Remove timestamps outside the window
    const validTimestamps = timestamps.filter(t => now - t < WINDOW_MS);

    if (validTimestamps.length >= MAX_REQUESTS) {
        // Find when the earliest request in the window will expire
        const oldestInWindow = validTimestamps[0];
        const resetMs = oldestInWindow + WINDOW_MS;

        windows.set(identifier, validTimestamps);

        return {
            allowed: false,
            limit: MAX_REQUESTS,
            remaining: 0,
            resetMs,
        };
    }

    // Allow request
    validTimestamps.push(now);
    windows.set(identifier, validTimestamps);

    const resetMs = validTimestamps[0] + WINDOW_MS;

    return {
        allowed: true,
        limit: MAX_REQUESTS,
        remaining: MAX_REQUESTS - validTimestamps.length,
        resetMs,
    };
}

export function setRateLimitHeaders(headers: Headers, result: RateLimitResult) {
    headers.set('X-RateLimit-Limit', result.limit.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', Math.ceil(result.resetMs / 1000).toString());
}
