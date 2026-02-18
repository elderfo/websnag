import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createEndpointSchema, updateEndpointSchema } from '@/lib/validators'
import { canCreateEndpoint, getUserPlan } from '@/lib/usage'
import { generateSlug, isValidCustomSlug } from '@/lib/utils'

// ---- Schema validation tests ----

describe('createEndpointSchema', () => {
  it('accepts valid input with only required fields', () => {
    const result = createEndpointSchema.safeParse({ name: 'My Endpoint' })
    expect(result.success).toBe(true)
  })

  it('accepts valid input with all fields', () => {
    const result = createEndpointSchema.safeParse({
      name: 'My Endpoint',
      slug: 'my-custom-slug',
      description: 'A test endpoint',
      response_code: 201,
      response_body: '{"created": true}',
      response_headers: { 'Content-Type': 'application/json' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createEndpointSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects name longer than 100 characters', () => {
    const result = createEndpointSchema.safeParse({ name: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('rejects invalid response_code', () => {
    const result = createEndpointSchema.safeParse({
      name: 'Test',
      response_code: 99,
    })
    expect(result.success).toBe(false)
  })

  it('rejects response_code above 599', () => {
    const result = createEndpointSchema.safeParse({
      name: 'Test',
      response_code: 600,
    })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer response_code', () => {
    const result = createEndpointSchema.safeParse({
      name: 'Test',
      response_code: 200.5,
    })
    expect(result.success).toBe(false)
  })

  it('rejects description longer than 500 characters', () => {
    const result = createEndpointSchema.safeParse({
      name: 'Test',
      description: 'a'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('rejects response_body longer than 10000 characters', () => {
    const result = createEndpointSchema.safeParse({
      name: 'Test',
      response_body: 'a'.repeat(10001),
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const result = createEndpointSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('updateEndpointSchema', () => {
  it('accepts partial updates with just name', () => {
    const result = updateEndpointSchema.safeParse({ name: 'Updated' })
    expect(result.success).toBe(true)
  })

  it('accepts is_active field', () => {
    const result = updateEndpointSchema.safeParse({ is_active: false })
    expect(result.success).toBe(true)
  })

  it('accepts empty object', () => {
    const result = updateEndpointSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects invalid is_active type', () => {
    const result = updateEndpointSchema.safeParse({ is_active: 'yes' })
    expect(result.success).toBe(false)
  })

  it('accepts slug in update', () => {
    const result = updateEndpointSchema.safeParse({ slug: 'new-slug' })
    expect(result.success).toBe(true)
  })
})

// ---- Slug validation tests ----

describe('isValidCustomSlug', () => {
  it('accepts valid slugs', () => {
    expect(isValidCustomSlug('my-webhook')).toBe(true)
    expect(isValidCustomSlug('abc')).toBe(true)
    expect(isValidCustomSlug('stripe-payments')).toBe(true)
    expect(isValidCustomSlug('test123')).toBe(true)
    expect(isValidCustomSlug('a'.repeat(48))).toBe(true)
  })

  it('rejects slugs with leading hyphens', () => {
    expect(isValidCustomSlug('-my-webhook')).toBe(false)
  })

  it('rejects slugs with trailing hyphens', () => {
    expect(isValidCustomSlug('my-webhook-')).toBe(false)
  })

  it('rejects slugs shorter than 3 characters', () => {
    expect(isValidCustomSlug('ab')).toBe(false)
  })

  it('rejects slugs longer than 48 characters', () => {
    expect(isValidCustomSlug('a'.repeat(49))).toBe(false)
  })

  it('rejects slugs with uppercase letters', () => {
    expect(isValidCustomSlug('MyWebhook')).toBe(false)
  })

  it('rejects slugs with special characters', () => {
    expect(isValidCustomSlug('my_webhook')).toBe(false)
    expect(isValidCustomSlug('my.webhook')).toBe(false)
    expect(isValidCustomSlug('my webhook')).toBe(false)
  })
})

describe('generateSlug', () => {
  it('generates a 12-character slug', () => {
    const slug = generateSlug()
    expect(slug).toHaveLength(12)
  })

  it('generates unique slugs', () => {
    const slugs = new Set(Array.from({ length: 100 }, () => generateSlug()))
    expect(slugs.size).toBe(100)
  })

  it('generates slugs with only valid characters', () => {
    const slug = generateSlug()
    expect(slug).toMatch(/^[a-z0-9]+$/)
  })
})

// ---- Usage / plan logic tests ----

describe('canCreateEndpoint', () => {
  it('allows free users to create up to 2 endpoints', () => {
    expect(canCreateEndpoint(0, 'free')).toBe(true)
    expect(canCreateEndpoint(1, 'free')).toBe(true)
  })

  it('blocks free users at 2 endpoints', () => {
    expect(canCreateEndpoint(2, 'free')).toBe(false)
  })

  it('allows pro users unlimited endpoints', () => {
    expect(canCreateEndpoint(100, 'pro')).toBe(true)
    expect(canCreateEndpoint(1000, 'pro')).toBe(true)
  })
})

describe('getUserPlan', () => {
  it('returns pro for active pro subscription', () => {
    expect(getUserPlan({ plan: 'pro', status: 'active' })).toBe('pro')
  })

  it('returns free for canceled pro subscription', () => {
    expect(getUserPlan({ plan: 'pro', status: 'canceled' })).toBe('free')
  })

  it('returns free for null subscription', () => {
    expect(getUserPlan(null)).toBe('free')
  })

  it('returns free for past_due status', () => {
    expect(getUserPlan({ plan: 'pro', status: 'past_due' })).toBe('free')
  })

  it('returns free for free plan', () => {
    expect(getUserPlan({ plan: 'free', status: 'active' })).toBe('free')
  })
})

// ---- API route integration tests (mocked Supabase) ----

// Mock modules before importing route handlers
const mockGetUser = vi.fn()
const mockFrom = vi.fn()
const mockAdminFrom = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockImplementation(async () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  })),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn().mockImplementation(() => ({
    from: mockAdminFrom,
  })),
}))

// Helper to create a chain of Supabase query methods
function createQueryChain(finalResult: { data?: unknown; error?: unknown; count?: number | null }) {
  const chain: Record<string, unknown> = {}
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'single']
  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue({ ...chain, ...finalResult })
  }
  // Ensure methods return the chain for chaining
  for (const method of methods) {
    ;(chain[method] as ReturnType<typeof vi.fn>).mockReturnValue({ ...chain, ...finalResult })
  }
  return chain
}

describe('GET /api/endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { GET } = await import('../route')
    const response = await GET()

    expect(response.status).toBe(401)
    const body = await response.json()
    expect(body.error).toBe('Unauthorized')
  })

  it('returns endpoints for authenticated user', async () => {
    const mockEndpoints = [
      { id: '1', name: 'Endpoint 1', slug: 'abc123' },
      { id: '2', name: 'Endpoint 2', slug: 'def456' },
    ]

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const chain = createQueryChain({ data: mockEndpoints, error: null })
    mockFrom.mockReturnValue(chain)

    const { GET } = await import('../route')
    const response = await GET()

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual(mockEndpoints)
  })

  it('returns 500 on database error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const chain = createQueryChain({ data: null, error: { message: 'DB error' } })
    mockFrom.mockReturnValue(chain)

    const { GET } = await import('../route')
    const response = await GET()

    expect(response.status).toBe(500)
  })
})

describe('POST /api/endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/endpoints', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(401)
  })

  it('returns 400 for invalid JSON body', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/endpoints', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Invalid JSON body')
  })

  it('returns 400 for missing name', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/endpoints', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(400)
  })

  it('returns 403 when endpoint limit reached for free user', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    // Subscription query returns null (free user)
    const subChain = createQueryChain({ data: null, error: null })
    // Count query returns 2 existing endpoints
    const countChain = createQueryChain({ data: null, error: null, count: 2 })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return subChain // subscriptions query
      return countChain // endpoints count query
    })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/endpoints', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toContain('Endpoint limit reached')
  })

  it('returns 403 when free user tries custom slug', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const subChain = createQueryChain({ data: null, error: null })
    const countChain = createQueryChain({ data: null, error: null, count: 0 })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return subChain
      return countChain
    })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/endpoints', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', slug: 'my-custom-slug' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(403)
    const body = await response.json()
    expect(body.error).toContain('Custom slugs')
  })

  it('returns 409 when slug is already taken', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const subChain = createQueryChain({ data: { plan: 'pro', status: 'active' }, error: null })
    const countChain = createQueryChain({ data: null, error: null, count: 0 })
    const adminSlugChain = createQueryChain({ data: { id: 'existing-id' }, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return subChain
      return countChain
    })
    mockAdminFrom.mockReturnValue(adminSlugChain)

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/endpoints', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test', slug: 'taken-slug' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(409)
    const body = await response.json()
    expect(body.error).toBe('Slug already taken.')
  })

  it('creates endpoint successfully with generated slug', async () => {
    const mockEndpoint = {
      id: 'new-id',
      name: 'Test',
      slug: 'generated123',
      user_id: 'user-1',
    }

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const subChain = createQueryChain({ data: null, error: null })
    const countChain = createQueryChain({ data: null, error: null, count: 0 })
    const insertChain = createQueryChain({ data: mockEndpoint, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return subChain
      if (callCount === 2) return countChain
      return insertChain
    })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/endpoints', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await POST(request)

    expect(response.status).toBe(201)
    const body = await response.json()
    expect(body.name).toBe('Test')
  })
})

describe('GET /api/endpoints/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { GET } = await import('../[id]/route')
    const request = new NextRequest('http://localhost/api/endpoints/test-id')
    const response = await GET(request, { params: Promise.resolve({ id: 'test-id' }) })

    expect(response.status).toBe(401)
  })

  it('returns 404 when endpoint not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const chain = createQueryChain({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    })
    mockFrom.mockReturnValue(chain)

    const { GET } = await import('../[id]/route')
    const request = new NextRequest('http://localhost/api/endpoints/nonexistent')
    const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) })

    expect(response.status).toBe(404)
  })

  it('returns endpoint when found', async () => {
    const mockEndpoint = { id: 'test-id', name: 'Test', slug: 'abc123' }
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const chain = createQueryChain({ data: mockEndpoint, error: null })
    mockFrom.mockReturnValue(chain)

    const { GET } = await import('../[id]/route')
    const request = new NextRequest('http://localhost/api/endpoints/test-id')
    const response = await GET(request, { params: Promise.resolve({ id: 'test-id' }) })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual(mockEndpoint)
  })
})

describe('DELETE /api/endpoints/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const routeModule = await import('../[id]/route')
    const request = new NextRequest('http://localhost/api/endpoints/test-id', { method: 'DELETE' })
    const response = await routeModule.DELETE(request, {
      params: Promise.resolve({ id: 'test-id' }),
    })

    expect(response.status).toBe(401)
  })

  it('returns 404 when endpoint not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const chain = createQueryChain({ data: null, error: null, count: 0 })
    mockFrom.mockReturnValue(chain)

    const routeModule = await import('../[id]/route')
    const request = new NextRequest('http://localhost/api/endpoints/nonexistent', {
      method: 'DELETE',
    })
    const response = await routeModule.DELETE(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    })

    expect(response.status).toBe(404)
  })

  it('returns 204 on successful deletion', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const chain = createQueryChain({ data: null, error: null, count: 1 })
    mockFrom.mockReturnValue(chain)

    const routeModule = await import('../[id]/route')
    const request = new NextRequest('http://localhost/api/endpoints/test-id', { method: 'DELETE' })
    const response = await routeModule.DELETE(request, {
      params: Promise.resolve({ id: 'test-id' }),
    })

    expect(response.status).toBe(204)
  })
})

describe('PATCH /api/endpoints/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })

    const { PATCH } = await import('../[id]/route')
    const request = new NextRequest('http://localhost/api/endpoints/test-id', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-id' }) })

    expect(response.status).toBe(401)
  })

  it('returns 404 when endpoint not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const chain = createQueryChain({
      data: null,
      error: { code: 'PGRST116', message: 'Not found' },
    })
    mockFrom.mockReturnValue(chain)

    const { PATCH } = await import('../[id]/route')
    const request = new NextRequest('http://localhost/api/endpoints/test-id', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await PATCH(request, { params: Promise.resolve({ id: 'nonexistent' }) })

    expect(response.status).toBe(404)
  })

  it('returns 400 for invalid JSON', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const chain = createQueryChain({
      data: { id: 'test-id', slug: 'old-slug' },
      error: null,
    })
    mockFrom.mockReturnValue(chain)

    const { PATCH } = await import('../[id]/route')
    const request = new NextRequest('http://localhost/api/endpoints/test-id', {
      method: 'PATCH',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    })
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-id' }) })

    expect(response.status).toBe(400)
  })

  it('updates endpoint successfully', async () => {
    const existingEndpoint = { id: 'test-id', name: 'Old', slug: 'old-slug' }
    const updatedEndpoint = { id: 'test-id', name: 'Updated', slug: 'old-slug' }

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const fetchChain = createQueryChain({ data: existingEndpoint, error: null })
    const updateChain = createQueryChain({ data: updatedEndpoint, error: null })

    let callCount = 0
    mockFrom.mockImplementation(() => {
      callCount++
      if (callCount === 1) return fetchChain
      return updateChain
    })

    const { PATCH } = await import('../[id]/route')
    const request = new NextRequest('http://localhost/api/endpoints/test-id', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Updated' }),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-id' }) })

    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.name).toBe('Updated')
  })

  it('returns 400 for empty update body', async () => {
    const existingEndpoint = { id: 'test-id', name: 'Old', slug: 'old-slug' }

    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })

    const chain = createQueryChain({ data: existingEndpoint, error: null })
    mockFrom.mockReturnValue(chain)

    const { PATCH } = await import('../[id]/route')
    const request = new NextRequest('http://localhost/api/endpoints/test-id', {
      method: 'PATCH',
      body: JSON.stringify({}),
      headers: { 'Content-Type': 'application/json' },
    })
    const response = await PATCH(request, { params: Promise.resolve({ id: 'test-id' }) })

    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('No fields to update')
  })
})
