import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock @upstash/redis before any imports that use it
vi.mock('@upstash/redis', () => {
  const mockRedisInstance = {}
  return {
    Redis: {
      fromEnv: vi.fn(() => mockRedisInstance),
    },
  }
})

// Mock @upstash/ratelimit
const mockLimit = vi.fn()

vi.mock('@upstash/ratelimit', () => {
  return {
    Ratelimit: class MockRatelimit {
      constructor() {}
      limit = mockLimit

      static slidingWindow = vi.fn((count: number, window: string) => ({
        type: 'slidingWindow',
        count,
        window,
      }))
    },
  }
})

import { checkSlugRateLimit, checkIpRateLimit } from '../rate-limit'

describe('checkSlugRateLimit', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns success result when under the limit', async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60_000,
    })

    const result = await checkSlugRateLimit('my-slug')

    expect(result).not.toBeNull()
    expect(result!.success).toBe(true)
    expect(result!.limit).toBe(60)
    expect(result!.remaining).toBe(59)
    expect(typeof result!.reset).toBe('number')
  })

  it('returns failure result when limit is exceeded', async () => {
    mockLimit.mockResolvedValueOnce({
      success: false,
      limit: 60,
      remaining: 0,
      reset: Date.now() + 30_000,
    })

    const result = await checkSlugRateLimit('my-slug')

    expect(result).not.toBeNull()
    expect(result!.success).toBe(false)
    expect(result!.remaining).toBe(0)
  })

  it('returns null (fail open) when Redis env vars are missing', async () => {
    process.env = { ...originalEnv }
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const result = await checkSlugRateLimit('my-slug')

    expect(result).toBeNull()
    expect(mockLimit).not.toHaveBeenCalled()
  })

  it('returns null (fail open) when Redis throws an error', async () => {
    mockLimit.mockRejectedValueOnce(new Error('Redis connection failed'))

    const result = await checkSlugRateLimit('my-slug')

    expect(result).toBeNull()
  })

  it('returns correct reset timestamp', async () => {
    const futureReset = Date.now() + 45_000
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 60,
      remaining: 40,
      reset: futureReset,
    })

    const result = await checkSlugRateLimit('my-slug')

    expect(result!.reset).toBe(futureReset)
  })
})

describe('checkIpRateLimit', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.clearAllMocks()
    process.env = {
      ...originalEnv,
      UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
    }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns success result when under the limit', async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 200,
      remaining: 199,
      reset: Date.now() + 60_000,
    })

    const result = await checkIpRateLimit('1.2.3.4')

    expect(result).not.toBeNull()
    expect(result!.success).toBe(true)
    expect(result!.limit).toBe(200)
    expect(result!.remaining).toBe(199)
  })

  it('returns failure result when IP limit is exceeded', async () => {
    mockLimit.mockResolvedValueOnce({
      success: false,
      limit: 200,
      remaining: 0,
      reset: Date.now() + 15_000,
    })

    const result = await checkIpRateLimit('1.2.3.4')

    expect(result).not.toBeNull()
    expect(result!.success).toBe(false)
    expect(result!.remaining).toBe(0)
  })

  it('returns null (fail open) when Redis env vars are missing', async () => {
    process.env = { ...originalEnv }
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const result = await checkIpRateLimit('1.2.3.4')

    expect(result).toBeNull()
    expect(mockLimit).not.toHaveBeenCalled()
  })

  it('returns null (fail open) when Redis throws an error', async () => {
    mockLimit.mockRejectedValueOnce(new Error('Redis connection failed'))

    const result = await checkIpRateLimit('1.2.3.4')

    expect(result).toBeNull()
  })
})
