'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { isJsonString, formatJson } from '@/lib/format'

interface ReplayResponse {
  status: number
  headers: Record<string, string>
  body: string
}

interface ReplayPanelProps {
  requestId: string
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return 'text-green-400'
  if (status >= 300 && status < 400) return 'text-yellow-400'
  if (status >= 400 && status < 500) return 'text-orange-400'
  return 'text-red-400'
}

export function ReplayPanel({ requestId }: ReplayPanelProps) {
  const [targetUrl, setTargetUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [response, setResponse] = useState<ReplayResponse | null>(null)
  const [headersExpanded, setHeadersExpanded] = useState(false)

  const handleReplay = async () => {
    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch('/api/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, targetUrl }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (res.status === 403) {
          setError('Replay is a Pro feature. Upgrade to use it.')
        } else {
          setError(data.error || 'Replay failed')
        }
        return
      }

      const data: ReplayResponse = await res.json()
      setResponse(data)
    } catch {
      setError('Failed to connect. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const isValidUrl = targetUrl.startsWith('http://') || targetUrl.startsWith('https://')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-text-muted">Replay</h3>
        <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
          PRO
        </span>
      </div>

      <p className="text-sm text-text-secondary">
        Forward this request to a target URL to test your webhook handler.
      </p>

      {/* URL input and replay button */}
      <div className="flex gap-2">
        <input
          type="url"
          placeholder="https://your-app.com/webhook"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 font-mono"
          aria-label="Target URL"
        />
        <Button
          variant="primary"
          size="md"
          onClick={handleReplay}
          disabled={!isValidUrl || loading}
        >
          {loading ? 'Replaying...' : 'Replay'}
        </Button>
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Response display */}
      {response && (
        <div className="rounded-lg border border-border overflow-hidden">
          {/* Status line */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-surface">
            <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
              Response
            </span>
            <span className={`font-mono font-bold ${statusColor(response.status)}`}>
              {response.status}
            </span>
          </div>

          {/* Response headers (collapsible) */}
          <div className="border-b border-border">
            <button
              type="button"
              onClick={() => setHeadersExpanded(!headersExpanded)}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg
                className={`h-3 w-3 transition-transform ${headersExpanded ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              Headers ({Object.keys(response.headers).length})
            </button>
            {headersExpanded && (
              <div className="px-4 pb-3">
                <div className="rounded-md border border-border overflow-hidden">
                  <table className="w-full text-xs">
                    <tbody>
                      {Object.entries(response.headers).map(([key, value]) => (
                        <tr key={key} className="border-b border-border last:border-b-0">
                          <td className="px-3 py-1.5 font-mono text-accent whitespace-nowrap">
                            {key}
                          </td>
                          <td className="px-3 py-1.5 font-mono text-text-secondary break-all">
                            {value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Response body */}
          <div className="p-4">
            <h4 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">
              Body
            </h4>
            {response.body ? (
              <pre className="rounded-lg bg-background p-4 font-mono text-sm text-text-primary overflow-auto max-h-96">
                {isJsonString(response.body) ? formatJson(response.body) : response.body}
              </pre>
            ) : (
              <p className="text-sm text-text-muted italic">Empty response body</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
