import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockHget = vi.fn()
const mockLimit = vi.fn()
const mockSlidingWindow = vi.fn().mockReturnValue('sliding-window-config')

vi.mock('@upstash/redis', () => ({
  Redis: {
    fromEnv: vi.fn(() => ({ hget: mockHget })),
  },
}))

vi.mock('@upstash/ratelimit', () => {
  function MockRatelimit() {
    return { limit: mockLimit }
  }
  MockRatelimit.slidingWindow = mockSlidingWindow
  return { Ratelimit: MockRatelimit }
})

vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}))

// We need to re-import the module under test each time because it uses
// module-level singletons that cache Redis/Ratelimit instances.
async function freshImport() {
  vi.resetModules()
  return await import('@/lib/rate-limit')
}

beforeEach(() => {
  mockLimit.mockReset()
  mockHget.mockReset()
  mockSlidingWindow.mockClear()

  process.env.UPSTASH_REDIS_REST_URL = 'https://fake.upstash.io'
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token'
})

describe('checkAccountRateLimit', () => {
  it('uses free tier limit (100/min) for free plan users', async () => {
    const { checkAccountRateLimit, ACCOUNT_RATE_LIMITS } = await freshImport()

    mockHget.mockResolvedValue(null)
    mockLimit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
    })

    const result = await checkAccountRateLimit('user-free-123', 'free')

    expect(result).not.toBeNull()
    expect(result!.success).toBe(true)
    expect(result!.limit).toBe(100)
    expect(result!.remaining).toBe(99)
    expect(mockSlidingWindow).toHaveBeenCalledWith(ACCOUNT_RATE_LIMITS.free, '1 m')
  })

  it('uses pro tier limit (500/min) for pro plan users', async () => {
    const { checkAccountRateLimit, ACCOUNT_RATE_LIMITS } = await freshImport()

    mockHget.mockResolvedValue(null)
    mockLimit.mockResolvedValue({
      success: true,
      limit: 500,
      remaining: 499,
      reset: Date.now() + 60_000,
    })

    const result = await checkAccountRateLimit('user-pro-456', 'pro')

    expect(result).not.toBeNull()
    expect(result!.success).toBe(true)
    expect(result!.limit).toBe(500)
    expect(result!.remaining).toBe(499)
    expect(mockSlidingWindow).toHaveBeenCalledWith(ACCOUNT_RATE_LIMITS.pro, '1 m')
  })

  it('applies per-account override when set in Redis', async () => {
    const { checkAccountRateLimit } = await freshImport()

    mockHget.mockResolvedValue('250')
    mockLimit.mockResolvedValue({
      success: true,
      limit: 250,
      remaining: 249,
      reset: Date.now() + 60_000,
    })

    const result = await checkAccountRateLimit('user-override-789', 'free')

    expect(result).not.toBeNull()
    expect(result!.limit).toBe(250)
    expect(mockHget).toHaveBeenCalledWith('rl:account:overrides', 'user-override-789')
    expect(mockSlidingWindow).toHaveBeenCalledWith(250, '1 m')
  })

  it('ignores invalid override values and falls back to tier default', async () => {
    const { checkAccountRateLimit } = await freshImport()

    mockHget.mockResolvedValue('not-a-number')
    mockLimit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
    })

    const result = await checkAccountRateLimit('user-bad-override', 'free')

    expect(result).not.toBeNull()
    expect(result!.limit).toBe(100)
  })

  it('returns rate-limited result when limit is exceeded', async () => {
    const { checkAccountRateLimit } = await freshImport()

    mockHget.mockResolvedValue(null)
    const resetTime = Date.now() + 30_000
    mockLimit.mockResolvedValue({
      success: false,
      limit: 100,
      remaining: 0,
      reset: resetTime,
    })

    const result = await checkAccountRateLimit('user-limited', 'free')

    expect(result).not.toBeNull()
    expect(result!.success).toBe(false)
    expect(result!.remaining).toBe(0)
    expect(result!.reset).toBe(resetTime)
  })

  it('fails open when Redis is unavailable (returns null)', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const { checkAccountRateLimit } = await freshImport()

    const result = await checkAccountRateLimit('user-no-redis', 'free')

    expect(result).toBeNull()
  })

  it('fails open when Redis limit() call throws', async () => {
    const { checkAccountRateLimit } = await freshImport()

    mockHget.mockResolvedValue(null)
    mockLimit.mockRejectedValue(new Error('Redis connection timeout'))

    const result = await checkAccountRateLimit('user-redis-error', 'pro')

    expect(result).toBeNull()
  })

  it('falls back to tier default when override lookup throws', async () => {
    const { checkAccountRateLimit } = await freshImport()

    mockHget.mockRejectedValue(new Error('Redis hget failed'))
    mockLimit.mockResolvedValue({
      success: true,
      limit: 500,
      remaining: 499,
      reset: Date.now() + 60_000,
    })

    const result = await checkAccountRateLimit('user-hget-error', 'pro')

    expect(result).not.toBeNull()
    expect(result!.success).toBe(true)
    expect(result!.limit).toBe(500)
  })

  it('ignores zero or negative override values', async () => {
    const { checkAccountRateLimit } = await freshImport()

    mockHget.mockResolvedValue('0')
    mockLimit.mockResolvedValue({
      success: true,
      limit: 100,
      remaining: 99,
      reset: Date.now() + 60_000,
    })

    const result = await checkAccountRateLimit('user-zero-override', 'free')

    expect(result).not.toBeNull()
    expect(result!.limit).toBe(100)
  })

  it('exports expected account rate limit constants', async () => {
    const { ACCOUNT_RATE_LIMITS } = await freshImport()

    expect(ACCOUNT_RATE_LIMITS.free).toBe(100)
    expect(ACCOUNT_RATE_LIMITS.pro).toBe(500)
  })
})
