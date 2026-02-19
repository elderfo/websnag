import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

function createRedisClient(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null
  }
  try {
    return Redis.fromEnv()
  } catch {
    return null
  }
}

function createRateLimiter(
  redis: Redis,
  limit: number,
  window: '1 m',
  prefix: string
): Ratelimit {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix,
  })
}

// Rate limit per slug: 60 requests per minute
export async function checkSlugRateLimit(slug: string): Promise<RateLimitResult | null> {
  const redis = createRedisClient()
  if (!redis) return null

  try {
    const limiter = createRateLimiter(redis, 60, '1 m', 'rl:slug')
    const result = await limiter.limit(slug)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch {
    // Fail open: if Redis is unavailable, allow the request
    return null
  }
}

// Rate limit per source IP: 200 requests per minute globally
export async function checkIpRateLimit(ip: string): Promise<RateLimitResult | null> {
  const redis = createRedisClient()
  if (!redis) return null

  try {
    const limiter = createRateLimiter(redis, 200, '1 m', 'rl:ip')
    const result = await limiter.limit(ip)
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    }
  } catch {
    // Fail open: if Redis is unavailable, allow the request
    return null
  }
}
