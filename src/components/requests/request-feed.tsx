'use client'

import { useState, useCallback } from 'react'
import { useRealtimeRequests } from '@/hooks/use-realtime-requests'
import { RequestRow } from './request-row'
import { RequestDetail } from './request-detail'
import { FilterBar } from './filter-bar'
import { BulkActions } from './bulk-actions'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CopyButton } from '@/components/ui/copy-button'
import { Button } from '@/components/ui/button'
import type { WebhookRequest, RequestFilters } from '@/types'

interface RequestFeedProps {
  endpointId: string
  endpointUrl: string
}

function isRecentRequest(request: WebhookRequest): boolean {
  const ageMs = Date.now() - new Date(request.received_at).getTime()
  return ageMs >= 0 && ageMs < 2000
}

export function RequestFeed({ endpointId, endpointUrl }: RequestFeedProps) {
  const [filters, setFilters] = useState<RequestFilters>({})
  const { requests, loading, hasMore, loadingMore, loadMore, removeRequest, removeRequests } =
    useRealtimeRequests(endpointId, filters)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const selectedRequest = requests.find((r) => r.id === selectedId) ?? null
  const showCheckboxes = checkedIds.size > 0

  const handleSelect = (request: WebhookRequest) => {
    setSelectedId(request.id === selectedId ? null : request.id)
  }

  const handleCheckChange = useCallback((requestId: string, checked: boolean) => {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (checked) {
        next.add(requestId)
      } else {
        next.delete(requestId)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setCheckedIds(new Set(requests.map((r) => r.id)))
  }, [requests])

  const handleClearSelection = useCallback(() => {
    setCheckedIds(new Set())
  }, [])

  // Single delete
  async function handleSingleDelete() {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/requests/${deleteConfirm}`, { method: 'DELETE' })
      if (res.ok) {
        removeRequest(deleteConfirm)
        if (selectedId === deleteConfirm) setSelectedId(null)
      }
    } finally {
      setDeleting(false)
      setDeleteConfirm(null)
    }
  }

  // Bulk delete
  async function handleBulkDelete() {
    const ids = Array.from(checkedIds)
    try {
      const res = await fetch('/api/requests/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestIds: ids }),
      })
      if (res.ok) {
        removeRequests(ids)
        setCheckedIds(new Set())
        if (selectedId && ids.includes(selectedId)) setSelectedId(null)
      }
    } catch {
      // Error handling is a no-op; UI state remains unchanged
    }
  }

  // Export helpers
  function buildExportUrl(): string {
    const params = new URLSearchParams({ endpointId })
    if (filters.method) params.set('method', filters.method)
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) params.set('dateTo', filters.dateTo)
    if (filters.search) params.set('search', filters.search)
    return `/api/requests/export?${params.toString()}`
  }

  function handleExportAll() {
    window.location.href = buildExportUrl()
  }

  function handleExportSelected() {
    // For selected export, download matching requests as JSON blob
    const selected = requests.filter((r) => checkedIds.has(r.id))
    const json = JSON.stringify(selected, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `requests-${endpointId}-selected.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <LoadingSkeleton />
  }

  if (requests.length === 0 && !filters.method && !filters.search && !filters.dateFrom && !filters.dateTo) {
    return <EmptyState endpointUrl={endpointUrl} />
  }

  return (
    <div className="space-y-3">
      <FilterBar filters={filters} onFiltersChange={setFilters} />

      <BulkActions
        selectedCount={checkedIds.size}
        onDelete={handleBulkDelete}
        onExport={handleExportSelected}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        allSelected={checkedIds.size === requests.length && requests.length > 0}
      />

      <div className="flex flex-col lg:flex-row gap-0 rounded-lg border border-border overflow-hidden bg-surface">
        {/* Request list */}
        <div className="lg:w-2/5 border-b lg:border-b-0 lg:border-r border-border overflow-auto max-h-[600px]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-xs font-medium uppercase tracking-wider text-text-muted">
              {requests.length} request{requests.length !== 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={handleExportAll}>
                Export
              </Button>
            </div>
          </div>

          {requests.length === 0 ? (
            <div className="p-8 text-center text-sm text-text-muted">
              No requests match your filters
            </div>
          ) : (
            <>
              {requests.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  isSelected={request.id === selectedId}
                  isChecked={checkedIds.has(request.id)}
                  isNew={isRecentRequest(request)}
                  showCheckbox={showCheckboxes}
                  onSelect={handleSelect}
                  onCheckChange={handleCheckChange}
                />
              ))}
              {hasMore && (
                <div className="p-3 text-center border-t border-border">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={loadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? 'Loading...' : 'Load more'}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:w-3/5 min-h-[400px]">
          {selectedRequest ? (
            <RequestDetail
              request={selectedRequest}
              endpointUrl={endpointUrl}
              onDelete={(id) => setDeleteConfirm(id)}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-text-muted">
              Select a request to view details
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete request"
        message="Are you sure you want to delete this request? This action cannot be undone."
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={handleSingleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
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
