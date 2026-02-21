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

/**
 * Simple in-memory sliding window rate limiter used as fallback when Redis
 * is unavailable. Not shared across serverless function instances, but
 * provides per-instance protection rather than failing completely open.
 */
class InMemoryRateLimiter {
  private windows = new Map<string, { count: number; resetAt: number }>()
  private readonly limit: number
  private readonly windowMs: number

  constructor(limit: number, windowMs: number) {
    this.limit = limit
    this.windowMs = windowMs
  }

  check(key: string): RateLimitResult {
    const now = Date.now()
    const entry = this.windows.get(key)

    if (!entry || now >= entry.resetAt) {
      this.windows.set(key, { count: 1, resetAt: now + this.windowMs })
      return {
        success: true,
        limit: this.limit,
        remaining: this.limit - 1,
        reset: now + this.windowMs,
      }
    }

    entry.count++
    const remaining = Math.max(0, this.limit - entry.count)
    const success = entry.count <= this.limit

    return { success, limit: this.limit, remaining, reset: entry.resetAt }
  }
}

const fallbackSlugLimiter = new InMemoryRateLimiter(60, 60_000)
const fallbackIpLimiter = new InMemoryRateLimiter(200, 60_000)
const fallbackAccountFreeLimiter = new InMemoryRateLimiter(ACCOUNT_RATE_LIMITS.free, 60_000)
const fallbackAccountProLimiter = new InMemoryRateLimiter(ACCOUNT_RATE_LIMITS.pro, 60_000)

// Module-level lazy singletons — initialized once on first use
let redis: Redis | null = null
let slugLimiter: Ratelimit | null = null
let ipLimiter: Ratelimit | null = null
let accountFreeLimiter: Ratelimit | null = null
let accountProLimiter: Ratelimit | null = null

function getRedis(): Redis | null {
  if (redis !== null) return redis
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    log.error(
      'UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set — using in-memory fallback rate limiting'
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
  if (!limiter) {
    return fallbackSlugLimiter.check(slug)
  }

  try {
    const result = await limiter.limit(slug)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    log.error({ err: error }, 'checkSlugRateLimit failed, using in-memory fallback')
    return fallbackSlugLimiter.check(slug)
  }
}

// Rate limit per source IP: 200 requests per minute globally
export async function checkIpRateLimit(ip: string): Promise<RateLimitResult | null> {
  const limiter = getIpLimiter()
  if (!limiter) {
    return fallbackIpLimiter.check(ip)
  }

  try {
    const result = await limiter.limit(ip)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch (error) {
    log.error({ err: error }, 'checkIpRateLimit failed, using in-memory fallback')
    return fallbackIpLimiter.check(ip)
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
    if (!client) {
      return (plan === 'free' ? fallbackAccountFreeLimiter : fallbackAccountProLimiter).check(
        userId
      )
    }

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
      if (!tierLimiter) {
        return (plan === 'free' ? fallbackAccountFreeLimiter : fallbackAccountProLimiter).check(
          userId
        )
      }
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
    log.error({ err: error, userId }, 'checkAccountRateLimit failed, using in-memory fallback')
    return (plan === 'free' ? fallbackAccountFreeLimiter : fallbackAccountProLimiter).check(userId)
  }
}
