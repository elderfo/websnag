import { describe, it, expect } from 'vitest'
import { parseAnalysisResponse } from '@/lib/anthropic'
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
})
