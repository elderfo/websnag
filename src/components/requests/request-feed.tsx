'use client'

import { useState } from 'react'
import { useRealtimeRequests } from '@/hooks/use-realtime-requests'
import { RequestRow } from './request-row'
import { RequestDetail } from './request-detail'
import { CopyButton } from '@/components/ui/copy-button'
import type { WebhookRequest } from '@/types'

interface RequestFeedProps {
  endpointId: string
  endpointUrl: string
}

/**
 * Returns whether a request is "new" based on its received_at timestamp.
 * Requests received within the last 2 seconds get the highlight animation.
 * This is a pure derivation from data — no state or effects needed.
 */
function isRecentRequest(request: WebhookRequest): boolean {
  const ageMs = Date.now() - new Date(request.received_at).getTime()
  return ageMs >= 0 && ageMs < 2000
}

export function RequestFeed({ endpointId, endpointUrl }: RequestFeedProps) {
  const { requests, loading } = useRealtimeRequests(endpointId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selectedRequest = requests.find((r) => r.id === selectedId) ?? null

  const handleSelect = (request: WebhookRequest) => {
    setSelectedId(request.id === selectedId ? null : request.id)
  }

  if (loading) {
    return <LoadingSkeleton />
  }

  if (requests.length === 0) {
    return <EmptyState endpointUrl={endpointUrl} />
  }

  return (
    <div className="flex flex-col lg:flex-row gap-0 rounded-lg border border-border overflow-hidden bg-surface">
      {/* Request list */}
      <div className="lg:w-2/5 border-b lg:border-b-0 lg:border-r border-border overflow-auto max-h-[600px]">
        <div className="px-4 py-2.5 border-b border-border">
          <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
            {requests.length} request{requests.length !== 1 ? 's' : ''}
          </span>
        </div>
        {requests.map((request) => (
          <RequestRow
            key={request.id}
            request={request}
            isSelected={request.id === selectedId}
            isNew={isRecentRequest(request)}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Detail panel */}
      <div className="lg:w-3/5 min-h-[400px]">
        {selectedRequest ? (
          <RequestDetail request={selectedRequest} endpointUrl={endpointUrl} />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-text-muted">
            Select a request to view details
          </div>
        )}
      </div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="h-5 w-14 rounded bg-white/5" />
            <div className="h-4 flex-1 rounded bg-white/5" />
            <div className="h-4 w-16 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ endpointUrl }: { endpointUrl: string }) {
  const curlExample = `curl -X POST ${endpointUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '{"test": true}'`

  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
      <div className="mx-auto h-12 w-12 rounded-full bg-white/5 flex items-center justify-center mb-4">
        <svg
          className="h-6 w-6 text-text-muted"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <p className="text-sm font-medium text-text-primary mb-1">No requests yet</p>
      <p className="text-xs text-text-muted mb-4">
        Send a request to your webhook URL to get started
      </p>
      <div className="mx-auto max-w-md">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-muted">Try this:</span>
          <CopyButton text={curlExample} label="Copy" />
        </div>
        <pre className="rounded-lg bg-background p-3 font-mono text-xs text-text-secondary text-left overflow-auto">
          {curlExample}
        </pre>
      </div>
    </div>
  )
}
