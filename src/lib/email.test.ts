import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock logger before importing the module under test
vi.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  }),
}))

describe('sendWelcomeEmail', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    delete process.env.RESEND_API_KEY
    process.env.NEXT_PUBLIC_APP_URL = 'https://websnag.dev'
  })

  afterEach(() => {
    process.env = originalEnv
    vi.restoreAllMocks()
  })

  it('logs email content when RESEND_API_KEY is not configured', async () => {
    const { sendWelcomeEmail } = await import('./email')

    // Should not throw
    await expect(sendWelcomeEmail('test@example.com', 'testuser')).resolves.toBeUndefined()
  })

  it('calls Resend API when RESEND_API_KEY is configured', async () => {
    process.env.RESEND_API_KEY = 'test-api-key'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'email-123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendWelcomeEmail } = await import('./email')
    await sendWelcomeEmail('test@example.com', 'testuser')

    expect(mockFetch).toHaveBeenCalledOnce()
    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toBe('https://api.resend.com/emails')
    expect(options.method).toBe('POST')

    const body = JSON.parse(options.body)
    expect(body.to).toEqual(['test@example.com'])
    expect(body.subject).toContain('Welcome to Websnag')
    expect(body.text).toContain('Hey testuser')
    expect(body.html).toContain('Hey testuser')
  })

  it('does not throw when Resend API call fails', async () => {
    process.env.RESEND_API_KEY = 'test-api-key'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendWelcomeEmail } = await import('./email')
    await expect(sendWelcomeEmail('test@example.com')).resolves.toBeUndefined()
  })

  it('does not throw when fetch itself throws', async () => {
    process.env.RESEND_API_KEY = 'test-api-key'

    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
    vi.stubGlobal('fetch', mockFetch)

    const { sendWelcomeEmail } = await import('./email')
    await expect(sendWelcomeEmail('test@example.com')).resolves.toBeUndefined()
  })

  it('uses generic greeting when no username provided', async () => {
    process.env.RESEND_API_KEY = 'test-api-key'

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'email-123' }),
    })
    vi.stubGlobal('fetch', mockFetch)

    const { sendWelcomeEmail } = await import('./email')
    await sendWelcomeEmail('test@example.com')

    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.text).toContain('Hey there')
    expect(body.html).toContain('Hey there')
  })
})
