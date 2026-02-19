import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

// Module-level lazy singletons — initialized once on first use
let redis: Redis | null = null
let slugLimiter: Ratelimit | null = null
let ipLimiter: Ratelimit | null = null

function getRedis(): Redis | null {
  if (redis !== null) return redis
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  try {
    redis = Redis.fromEnv()
    return redis
  } catch (error) {
    console.error('[rate-limit] Failed to create Redis client:', error)
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
    console.error('[rate-limit] checkSlugRateLimit failed:', error)
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
    console.error('[rate-limit] checkIpRateLimit failed:', error)
    return null
  }
}
