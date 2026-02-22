import { describe, it, expect } from 'vitest'
import {
  createEndpointSchema,
  updateEndpointSchema,
  analyzeRequestSchema,
  replayRequestSchema,
} from '@/lib/validators'

describe('createEndpointSchema', () => {
  it('accepts valid input with only required fields', () => {
    const result = createEndpointSchema.safeParse({ name: 'My Webhook' })
    expect(result.success).toBe(true)
  })

  it('accepts valid input with all fields', () => {
    const result = createEndpointSchema.safeParse({
      name: 'My Webhook',
      slug: 'my-webhook',
      description: 'A test webhook endpoint',
      response_code: 200,
      response_body: '{"ok": true}',
      response_headers: { 'Content-Type': 'application/json' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = createEndpointSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const result = createEndpointSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects name that is too long', () => {
    const result = createEndpointSchema.safeParse({ name: 'a'.repeat(101) })
    expect(result.success).toBe(false)
  })

  it('accepts name at exactly 100 chars', () => {
    const result = createEndpointSchema.safeParse({ name: 'a'.repeat(100) })
    expect(result.success).toBe(true)
  })

  it('rejects description that is too long', () => {
    const result = createEndpointSchema.safeParse({
      name: 'Test',
      description: 'a'.repeat(501),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid response_code', () => {
    const result1 = createEndpointSchema.safeParse({
      name: 'Test',
      response_code: 99,
    })
    expect(result1.success).toBe(false)

    const result2 = createEndpointSchema.safeParse({
      name: 'Test',
      response_code: 600,
    })
    expect(result2.success).toBe(false)
  })

  it('rejects non-integer response_code', () => {
    const result = createEndpointSchema.safeParse({
      name: 'Test',
      response_code: 200.5,
    })
    expect(result.success).toBe(false)
  })

  it.each([300, 301, 302, 303, 307, 308, 399])('rejects redirect status code %d', (code) => {
    const result = createEndpointSchema.safeParse({
      name: 'Test',
      response_code: code,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((i) => i.message)
      expect(messages).toContain('Redirect status codes (300-399) are not allowed')
    }
  })

  it('accepts non-redirect status codes around the boundary', () => {
    // 299 should be allowed
    const result299 = createEndpointSchema.safeParse({ name: 'Test', response_code: 299 })
    expect(result299.success).toBe(true)

    // 400 should be allowed
    const result400 = createEndpointSchema.safeParse({ name: 'Test', response_code: 400 })
    expect(result400.success).toBe(true)
  })

  it('rejects response_body that is too long', () => {
    const result = createEndpointSchema.safeParse({
      name: 'Test',
      response_body: 'a'.repeat(10001),
    })
    expect(result.success).toBe(false)
  })
})

describe('updateEndpointSchema', () => {
  it('allows partial updates (no required fields)', () => {
    const result = updateEndpointSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('allows updating just the name', () => {
    const result = updateEndpointSchema.safeParse({ name: 'New Name' })
    expect(result.success).toBe(true)
  })

  it('allows updating is_active', () => {
    const result = updateEndpointSchema.safeParse({ is_active: false })
    expect(result.success).toBe(true)
  })

  it('allows updating multiple fields', () => {
    const result = updateEndpointSchema.safeParse({
      name: 'Updated',
      description: 'Updated description',
      is_active: true,
      response_code: 201,
    })
    expect(result.success).toBe(true)
  })

  it('still validates field constraints', () => {
    const result = updateEndpointSchema.safeParse({
      name: '',
    })
    expect(result.success).toBe(false)
  })
})

describe('analyzeRequestSchema', () => {
  it('accepts a valid UUID', () => {
    const result = analyzeRequestSchema.safeParse({
      requestId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid UUID', () => {
    const result = analyzeRequestSchema.safeParse({
      requestId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing requestId', () => {
    const result = analyzeRequestSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('replayRequestSchema', () => {
  it('accepts valid requestId and targetUrl', () => {
    const result = replayRequestSchema.safeParse({
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      targetUrl: 'https://example.com/webhook',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid UUID', () => {
    const result = replayRequestSchema.safeParse({
      requestId: 'bad',
      targetUrl: 'https://example.com/webhook',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid URL', () => {
    const result = replayRequestSchema.safeParse({
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      targetUrl: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing targetUrl', () => {
    const result = replayRequestSchema.safeParse({
      requestId: '550e8400-e29b-41d4-a716-446655440000',
    })
    expect(result.success).toBe(false)
  })
})
