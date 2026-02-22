import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock Supabase SSR
const mockGetUser = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn().mockImplementation(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}))

vi.mock('@/lib/security', () => ({
  isValidOrigin: vi.fn().mockImplementation((origin: string | null, appUrl: string) => {
    if (origin === null) return true
    if (origin === '') return false
    try {
      const originUrl = new URL(origin)
      const appUrlParsed = new URL(appUrl)
      return originUrl.origin === appUrlParsed.origin
    } catch {
      return false
    }
  }),
}))

function createNextRequest(
  url: string,
  method: string = 'GET',
  headers: Record<string, string> = {}
): NextRequest {
  return new NextRequest(new URL(url), { method, headers })
}

import { updateSession } from '../middleware'

describe('middleware CORS headers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test'
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('sets CORS headers for authenticated API routes with valid origin', async () => {
    const request = createNextRequest('http://localhost:3000/api/analyze', 'GET', {
      origin: 'http://localhost:3000',
    })

    const response = await updateSession(request)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
    expect(response.headers.get('Access-Control-Allow-Credentials')).toBe('true')
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe(
      'GET, POST, PUT, PATCH, DELETE'
    )
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization')
    expect(response.headers.get('Vary')).toContain('Origin')
  })

  it('does not set CORS headers when origin does not match', async () => {
    const request = createNextRequest('http://localhost:3000/api/analyze', 'GET', {
      origin: 'http://evil.com',
    })

    const response = await updateSession(request)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
    // Vary: Origin is always set for API routes regardless of origin match
    expect(response.headers.get('Vary')).toContain('Origin')
  })

  it('does not set CORS headers when no origin is provided', async () => {
    const request = createNextRequest('http://localhost:3000/api/analyze', 'GET')

    const response = await updateSession(request)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('does not set CORS headers for webhook capture routes', async () => {
    const request = createNextRequest('http://localhost:3000/api/wh/my-slug', 'POST', {
      origin: 'http://localhost:3000',
    })

    const response = await updateSession(request)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('does not set CORS headers for Stripe webhook route', async () => {
    const request = createNextRequest('http://localhost:3000/api/stripe/webhook', 'POST', {
      origin: 'http://localhost:3000',
    })

    const response = await updateSession(request)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })

  it('does not set CORS headers for health routes', async () => {
    const request = createNextRequest('http://localhost:3000/api/health', 'GET', {
      origin: 'http://localhost:3000',
    })

    const response = await updateSession(request)

    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
  })
})
