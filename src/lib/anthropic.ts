import Anthropic from '@anthropic-ai/sdk'
import type { AiAnalysis } from '@/types'

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _client
}

const SYSTEM_PROMPT = `You are a webhook payload analyzer. Given an HTTP request (method, headers, body), identify what kind of webhook this is, explain it in plain English, and generate handler code.

Respond ONLY with valid JSON, no markdown fences, no preamble:
{
  "source": "Service name (e.g., Stripe, GitHub, Shopify) or 'Unknown'",
  "webhook_type": "Specific event type (e.g., payment_intent.succeeded, push, orders/create)",
  "summary": "1-2 sentence plain English explanation of what this webhook means and what action you'd typically take",
  "key_fields": [
    {"path": "json.path.to.field", "description": "what this field means"}
  ],
  "schema_notes": "Any missing, unusual, or notable fields compared to typical payloads from this source. Say 'Looks standard' if nothing unusual.",
  "handler_node": "// Complete Express.js route handler (10-20 lines)",
  "handler_python": "# Complete Flask route handler (10-20 lines)"
}`

export async function analyzeWebhook(
  method: string,
  headers: Record<string, string>,
  body: string | null,
  contentType: string | null
): Promise<AiAnalysis> {
  const message = await getClient().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Analyze this webhook request:\n\nMethod: ${method}\nContent-Type: ${contentType}\n\nHeaders:\n${JSON.stringify(headers, null, 2)}\n\nBody:\n${body ?? '(empty)'}`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return parseAnalysisResponse(text)
}

export function parseAnalysisResponse(text: string): AiAnalysis {
  // Strip markdown fences if present
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()
  return JSON.parse(cleaned)
}
