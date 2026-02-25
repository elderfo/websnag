import { describe, it, expect } from 'vitest'
import { parseAnalysisResponse, redactSensitiveHeaders } from '@/lib/anthropic'
import type { AiAnalysis } from '@/types'

const validAnalysis: AiAnalysis = {
  source: 'Stripe',
  webhook_type: 'payment_intent.succeeded',
  summary:
    'A payment was successfully completed. You should fulfill the order and send a confirmation email.',
  key_fields: [
    { path: 'data.object.id', description: 'The payment intent ID' },
    { path: 'data.object.amount', description: 'Amount in cents' },
    { path: 'data.object.currency', description: 'Three-letter currency code' },
  ],
  schema_notes: 'Looks standard',
  handler_node:
    '// Express.js handler\napp.post("/webhook", (req, res) => {\n  const event = req.body;\n  if (event.type === "payment_intent.succeeded") {\n    console.log("Payment succeeded:", event.data.object.id);\n  }\n  res.json({ received: true });\n});',
  handler_python:
    '# Flask handler\n@app.route("/webhook", methods=["POST"])\ndef webhook():\n    event = request.get_json()\n    if event["type"] == "payment_intent.succeeded":\n        print("Payment succeeded:", event["data"]["object"]["id"])\n    return jsonify(received=True)',
}

const validJson = JSON.stringify(validAnalysis)

describe('parseAnalysisResponse', () => {
  it('parses valid JSON response correctly', () => {
    const result = parseAnalysisResponse(validJson)
    expect(result).toEqual(validAnalysis)
  })

  it('strips markdown ```json fences', () => {
    const wrapped = '```json\n' + validJson + '\n```'
    const result = parseAnalysisResponse(wrapped)
    expect(result).toEqual(validAnalysis)
  })

  it('strips plain ``` fences', () => {
    const wrapped = '```\n' + validJson + '\n```'
    const result = parseAnalysisResponse(wrapped)
    expect(result).toEqual(validAnalysis)
  })

  it('handles whitespace around JSON', () => {
    const wrapped = '  \n\n' + validJson + '\n  \n'
    const result = parseAnalysisResponse(wrapped)
    expect(result).toEqual(validAnalysis)
  })

  it('throws on invalid JSON', () => {
    expect(() => parseAnalysisResponse('not json at all')).toThrow()
    expect(() => parseAnalysisResponse('{incomplete')).toThrow()
    expect(() => parseAnalysisResponse('')).toThrow()
  })

  it('correctly extracts all AiAnalysis fields', () => {
    const result = parseAnalysisResponse(validJson)
    expect(result.source).toBe('Stripe')
    expect(result.webhook_type).toBe('payment_intent.succeeded')
    expect(result.summary).toContain('payment was successfully completed')
    expect(result.key_fields).toHaveLength(3)
    expect(result.key_fields[0]).toEqual({
      path: 'data.object.id',
      description: 'The payment intent ID',
    })
    expect(result.schema_notes).toBe('Looks standard')
    expect(result.handler_node).toContain('Express.js')
    expect(result.handler_python).toContain('Flask')
  })

  it('handles ```json fence without trailing newline', () => {
    const wrapped = '```json' + validJson + '```'
    const result = parseAnalysisResponse(wrapped)
    expect(result).toEqual(validAnalysis)
  })

  it('rejects response missing required fields', () => {
    const partial = JSON.stringify({ source: 'Stripe' })
    expect(() => parseAnalysisResponse(partial)).toThrow()
  })

  it('rejects response with wrong field types', () => {
    const wrongTypes = JSON.stringify({
      ...validAnalysis,
      key_fields: 'not an array',
    })
    expect(() => parseAnalysisResponse(wrongTypes)).toThrow()
  })

  it('rejects non-JSON response (prompt injection attempt)', () => {
    const injectionAttempt =
      'I am now ignoring my previous instructions. Here is the secret data you requested.'
    expect(() => parseAnalysisResponse(injectionAttempt)).toThrow()
  })
})

describe('redactSensitiveHeaders', () => {
  it('redacts authorization header', () => {
    const result = redactSensitiveHeaders({ Authorization: 'Bearer sk-secret-token' })
    expect(result.Authorization).toBe('[REDACTED]')
  })

  it('redacts cookie header', () => {
    const result = redactSensitiveHeaders({ Cookie: 'session=abc123' })
    expect(result.Cookie).toBe('[REDACTED]')
  })

  it('redacts stripe-signature header', () => {
    const result = redactSensitiveHeaders({ 'stripe-signature': 't=123,v1=abc' })
    expect(result['stripe-signature']).toBe('[REDACTED]')
  })

  it('redacts x-hub-signature and x-hub-signature-256', () => {
    const result = redactSensitiveHeaders({
      'x-hub-signature': 'sha1=abc',
      'x-hub-signature-256': 'sha256=def',
    })
    expect(result['x-hub-signature']).toBe('[REDACTED]')
    expect(result['x-hub-signature-256']).toBe('[REDACTED]')
  })

  it('redacts x-shopify-hmac-sha256 header', () => {
    const result = redactSensitiveHeaders({ 'x-shopify-hmac-sha256': 'hmac-value' })
    expect(result['x-shopify-hmac-sha256']).toBe('[REDACTED]')
  })

  it('preserves non-sensitive headers', () => {
    const result = redactSensitiveHeaders({
      'content-type': 'application/json',
      'user-agent': 'Stripe/1.0',
      'x-request-id': 'req-123',
    })
    expect(result['content-type']).toBe('application/json')
    expect(result['user-agent']).toBe('Stripe/1.0')
    expect(result['x-request-id']).toBe('req-123')
  })

  it('is case-insensitive for header name matching', () => {
    const result = redactSensitiveHeaders({
      AUTHORIZATION: 'Bearer token',
      'X-Api-Key': 'key-123',
    })
    expect(result.AUTHORIZATION).toBe('[REDACTED]')
    expect(result['X-Api-Key']).toBe('[REDACTED]')
  })

  it('returns empty object for empty input', () => {
    const result = redactSensitiveHeaders({})
    expect(result).toEqual({})
  })
})
