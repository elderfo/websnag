import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock @upstash/redis before any imports that use it
const mockFromEnv = vi.fn()

vi.mock('@upstash/redis', () => {
  const mockRedisInstance = {}
  return {
    Redis: {
      fromEnv: (...args: unknown[]) => mockFromEnv(...args) ?? mockRedisInstance,
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

// Because the module uses lazy singletons, we must re-import after each test
// that manipulates env vars so the singletons are freshly initialized.
const originalEnv = process.env

async function importRateLimit() {
  const mod = await import('../rate-limit')
  return mod
}

describe('checkSlugRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    // Default: valid Redis env vars
    process.env = {
      ...originalEnv,
      UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
    }
    // Default: fromEnv returns a valid-ish object (the mock already does this, just reset)
    mockFromEnv.mockReturnValue(undefined) // let the factory default kick in
  })

  afterEach(() => {
    process.env = originalEnv
    vi.resetModules()
  })

  it('returns success result when under the limit', async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60_000,
    })

    const { checkSlugRateLimit } = await importRateLimit()
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

    const { checkSlugRateLimit } = await importRateLimit()
    const result = await checkSlugRateLimit('my-slug')

    expect(result).not.toBeNull()
    expect(result!.success).toBe(false)
    expect(result!.remaining).toBe(0)
  })

  it('returns null (fail open) when Redis env vars are missing', async () => {
    process.env = { ...originalEnv }
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const { checkSlugRateLimit } = await importRateLimit()
    const result = await checkSlugRateLimit('my-slug')

    expect(result).toBeNull()
    expect(mockLimit).not.toHaveBeenCalled()
  })

  it('returns null (fail open) when Redis throws an error', async () => {
    mockLimit.mockRejectedValueOnce(new Error('Redis connection failed'))

    const { checkSlugRateLimit } = await importRateLimit()
    const result = await checkSlugRateLimit('my-slug')

    expect(result).toBeNull()
  })

  it('returns null (fail open) when Redis.fromEnv() throws', async () => {
    mockFromEnv.mockImplementationOnce(() => {
      throw new Error('Redis.fromEnv failed')
    })

    const { checkSlugRateLimit } = await importRateLimit()
    const result = await checkSlugRateLimit('my-slug')

    expect(result).toBeNull()
    expect(mockLimit).not.toHaveBeenCalled()
  })

  it('returns correct reset timestamp', async () => {
    const futureReset = Date.now() + 45_000
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 60,
      remaining: 40,
      reset: futureReset,
    })

    const { checkSlugRateLimit } = await importRateLimit()
    const result = await checkSlugRateLimit('my-slug')

    expect(result!.reset).toBe(futureReset)
  })

  it('passes the slug as the rate limit key', async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 60,
      remaining: 59,
      reset: Date.now() + 60_000,
    })

    const { checkSlugRateLimit } = await importRateLimit()
    await checkSlugRateLimit('specific-slug-key')

    expect(mockLimit).toHaveBeenCalledWith('specific-slug-key')
  })
})

describe('checkIpRateLimit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env = {
      ...originalEnv,
      UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
    }
    mockFromEnv.mockReturnValue(undefined)
  })

  afterEach(() => {
    process.env = originalEnv
    vi.resetModules()
  })

  it('returns success result when under the limit', async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 200,
      remaining: 199,
      reset: Date.now() + 60_000,
    })

    const { checkIpRateLimit } = await importRateLimit()
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

    const { checkIpRateLimit } = await importRateLimit()
    const result = await checkIpRateLimit('1.2.3.4')

    expect(result).not.toBeNull()
    expect(result!.success).toBe(false)
    expect(result!.remaining).toBe(0)
  })

  it('returns null (fail open) when Redis env vars are missing', async () => {
    process.env = { ...originalEnv }
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const { checkIpRateLimit } = await importRateLimit()
    const result = await checkIpRateLimit('1.2.3.4')

    expect(result).toBeNull()
    expect(mockLimit).not.toHaveBeenCalled()
  })

  it('returns null (fail open) when Redis throws an error', async () => {
    mockLimit.mockRejectedValueOnce(new Error('Redis connection failed'))

    const { checkIpRateLimit } = await importRateLimit()
    const result = await checkIpRateLimit('1.2.3.4')

    expect(result).toBeNull()
  })

  it('returns null (fail open) when Redis.fromEnv() throws', async () => {
    mockFromEnv.mockImplementationOnce(() => {
      throw new Error('Redis.fromEnv failed')
    })

    const { checkIpRateLimit } = await importRateLimit()
    const result = await checkIpRateLimit('1.2.3.4')

    expect(result).toBeNull()
    expect(mockLimit).not.toHaveBeenCalled()
  })

  it('passes the IP as the rate limit key', async () => {
    mockLimit.mockResolvedValueOnce({
      success: true,
      limit: 200,
      remaining: 199,
      reset: Date.now() + 60_000,
    })

    const { checkIpRateLimit } = await importRateLimit()
    await checkIpRateLimit('10.20.30.40')

    expect(mockLimit).toHaveBeenCalledWith('10.20.30.40')
  })
})
