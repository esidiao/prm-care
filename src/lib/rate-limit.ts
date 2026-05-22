/**
 * Simple in-memory rate limiter.
 * Adequate for single-instance deployments (Vercel serverless: one instance per isolate).
 * For multi-instance production use Upstash Redis instead.
 */

interface Window {
  count: number
  resetAt: number
}

const store = new Map<string, Window>()

export interface RateLimitOptions {
  /** Maximum requests per window */
  limit: number
  /** Window duration in seconds */
  windowSecs: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
}

export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  let win = store.get(key)

  if (!win || win.resetAt < now) {
    win = { count: 0, resetAt: now + opts.windowSecs * 1000 }
    store.set(key, win)
  }

  win.count++
  const remaining = Math.max(0, opts.limit - win.count)

  // Prune stale entries periodically (every ~500 checks)
  if (Math.random() < 0.002) {
    for (const [k, v] of store.entries()) {
      if (v.resetAt < now) store.delete(k)
    }
  }

  return {
    success: win.count <= opts.limit,
    remaining,
    resetAt: win.resetAt,
  }
}

// Pre-configured limiters
export const authLimiter    = (ip: string) => rateLimit(`auth:${ip}`,    { limit: 10,  windowSecs: 60 })
export const registerLimiter= (ip: string) => rateLimit(`reg:${ip}`,     { limit: 5,   windowSecs: 300 })
export const analysisLimiter= (ip: string) => rateLimit(`analysis:${ip}`,{ limit: 20,  windowSecs: 60 })
export const exportLimiter  = (ip: string) => rateLimit(`export:${ip}`,  { limit: 10,  windowSecs: 300 })
