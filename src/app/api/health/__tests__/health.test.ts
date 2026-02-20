import { describe, it, expect, vi } from 'vitest'

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockImplementation(() => ({
    from: () => ({
      select: () => ({
        limit: () => Promise.resolve({ data: [{}], error: null }),
      }),
    }),
  })),
}))

import { GET } from '../route'

describe('GET /api/health', () => {
  it('returns 200 with status ok when database is reachable', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.status).toBe('ok')
    expect(json.timestamp).toBeDefined()
    expect(json.database).toBe('connected')
    expect(typeof json.durationMs).toBe('number')
  })
})

describe('GET /api/health (database unreachable)', () => {
  it('returns 503 with status degraded when database query fails', async () => {
    vi.resetModules()

    vi.doMock('@supabase/supabase-js', () => ({
      createClient: vi.fn().mockImplementation(() => ({
        from: () => ({
          select: () => ({
            limit: () => Promise.resolve({ data: null, error: { message: 'connection refused' } }),
          }),
        }),
      })),
    }))

    const { GET: FailGET } = await import('../route')
    const res = await FailGET()
    expect(res.status).toBe(503)
    const json = await res.json()
    expect(json.status).toBe('degraded')
    expect(json.database).toBe('unreachable')
  })
})
