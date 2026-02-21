import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { createLogger } from '@/lib/logger'
import type { Plan } from '@/types'

const log = createLogger('rate-limit')

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

export const ACCOUNT_RATE_LIMITS: Record<Plan, number> = {
  free: 100,
  pro: 500,
} as const

// Module-level lazy singletons — initialized once on first use
let redis: Redis | null = null
let slugLimiter: Ratelimit | null = null
let ipLimiter: Ratelimit | null = null
let accountFreeLimiter: Ratelimit | null = null
let accountProLimiter: Ratelimit | null = null

function getRedis(): Redis | null {
  if (redis !== null) return redis
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    log.warn(
      'UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set — rate limiting is DISABLED'
    )
    return null
  }
  try {
    redis = Redis.fromEnv()
    return redis
  } catch (error) {
    log.error({ err: error }, 'failed to create Redis client')
    return null
  }
}

function getSlugLimiter(): Ratelimit | null {
  if (slugLimiter !== null) return slugLimiter
  const client = getRedis()
  if (!client) return null
  slugLimiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(60, '1 m'),
    prefix: 'rl:slug',
  })
  return slugLimiter
}

function getIpLimiter(): Ratelimit | null {
  if (ipLimiter !== null) return ipLimiter
  const client = getRedis()
  if (!client) return null
  ipLimiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(200, '1 m'),
    prefix: 'rl:ip',
  })
  return ipLimiter
}

// Rate limit per slug: 60 requests per minute
export async function checkSlugRateLimit(slug: string): Promise<RateLimitResult | null> {
  const limiter = getSlugLimiter()
  if (!limiter) return null

  try {
    const result = await limiter.limit(slug)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    // Fail open: if Redis is unavailable, allow the request
    log.error({ err: error }, 'checkSlugRateLimit failed')
    return null
  }
}

// Rate limit per source IP: 200 requests per minute globally
export async function checkIpRateLimit(ip: string): Promise<RateLimitResult | null> {
  const limiter = getIpLimiter()
  if (!limiter) return null

  try {
    const result = await limiter.limit(ip)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    // Fail open: if Redis is unavailable, allow the request
    log.error({ err: error }, 'checkIpRateLimit failed')
    return null
  }
}

function getAccountLimiter(plan: Plan): Ratelimit | null {
  if (plan === 'free') {
    if (accountFreeLimiter !== null) return accountFreeLimiter
    const client = getRedis()
    if (!client) return null
    accountFreeLimiter = new Ratelimit({
      redis: client,
      limiter: Ratelimit.slidingWindow(ACCOUNT_RATE_LIMITS.free, '1 m'),
      prefix: 'rl:account',
    })
    return accountFreeLimiter
  }

  if (accountProLimiter !== null) return accountProLimiter
  const client = getRedis()
  if (!client) return null
  accountProLimiter = new Ratelimit({
    redis: client,
    limiter: Ratelimit.slidingWindow(ACCOUNT_RATE_LIMITS.pro, '1 m'),
    prefix: 'rl:account',
  })
  return accountProLimiter
}

// Rate limit per account: tier-aware (free=100/min, pro=500/min) with per-account overrides
export async function checkAccountRateLimit(
  userId: string,
  plan: Plan
): Promise<RateLimitResult | null> {
  try {
    const client = getRedis()
    if (!client) return null

    // Check for per-account override before applying tier default
    let overrideLimit: number | null = null
    try {
      const raw = await client.hget<string>('rl:account:overrides', userId)
      if (raw !== null && raw !== undefined) {
        const parsed = parseInt(String(raw), 10)
        if (!isNaN(parsed) && parsed > 0) {
          overrideLimit = parsed
        }
      }
    } catch (error) {
      // Fail open: if override lookup fails, fall through to tier default
      log.warn({ err: error, userId }, 'account rate limit override lookup failed')
    }

    let limiter: Ratelimit
    if (overrideLimit !== null) {
      // Dynamic limiter for overridden accounts
      limiter = new Ratelimit({
        redis: client,
        limiter: Ratelimit.slidingWindow(overrideLimit, '1 m'),
        prefix: 'rl:account',
      })
    } else {
      const tierLimiter = getAccountLimiter(plan)
      if (!tierLimiter) return null
      limiter = tierLimiter
    }

    const result = await limiter.limit(userId)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    // Fail open: if Redis is unavailable, allow the request
    log.error({ err: error, userId }, 'checkAccountRateLimit failed')
    return null
  }
}
