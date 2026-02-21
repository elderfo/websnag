'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { AuditLogEntry } from '@/types'

const PAGE_SIZE = 50

const ACTION_LABELS: Record<string, string> = {
  create: 'Created',
  delete: 'Deleted',
  analyze: 'Analyzed',
  replay: 'Replayed',
  subscription_changed: 'Subscription Changed',
}

const RESOURCE_LABELS: Record<string, string> = {
  endpoint: 'Endpoint',
  request: 'Request',
  subscription: 'Subscription',
}

function actionBadgeVariant(action: string): 'success' | 'error' | 'info' | 'warning' | 'default' {
  switch (action) {
    case 'create':
      return 'success'
    case 'delete':
      return 'error'
    case 'analyze':
      return 'info'
    case 'replay':
      return 'warning'
    case 'subscription_changed':
      return 'info'
    default:
      return 'default'
  }
}

function formatDetails(entry: AuditLogEntry): string {
  const parts: string[] = []

  if (entry.metadata && typeof entry.metadata === 'object') {
    const meta = entry.metadata as Record<string, unknown>

    if (meta.name) parts.push(`name: ${String(meta.name)}`)
    if (meta.slug) parts.push(`slug: ${String(meta.slug)}`)
    if (meta.source) parts.push(`source: ${String(meta.source)}`)
    if (meta.webhookType) parts.push(`type: ${String(meta.webhookType)}`)
    if (meta.targetUrl) parts.push(`target: ${String(meta.targetUrl)}`)
    if (meta.event) parts.push(`event: ${String(meta.event)}`)
    if (meta.plan) parts.push(`plan: ${String(meta.plan)}`)
    if (meta.status) parts.push(`status: ${String(meta.status)}`)
    if (meta.cancelAtPeriodEnd !== undefined)
      parts.push(`cancelAtPeriodEnd: ${String(meta.cancelAtPeriodEnd)}`)
  }

  return parts.join(', ')
}

export function AuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchEntries = useCallback(async (offset: number) => {
    const supabase = createClient()
    const { data, error: fetchError } = await supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1)

    if (fetchError) {
      setError('Failed to load activity log')
      return []
    }

    return (data as AuditLogEntry[]) ?? []
  }, [])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      const data = await fetchEntries(0)
      setEntries(data)
      setHasMore(data.length === PAGE_SIZE)
      setLoading(false)
    }
    load()
  }, [fetchEntries])

  async function handleLoadMore() {
    setLoadingMore(true)
    const data = await fetchEntries(entries.length)
    setEntries((prev) => [...prev, ...data])
    setHasMore(data.length === PAGE_SIZE)
    setLoadingMore(false)
  }

  if (loading) {
    return (
      <Card>
        <h2 className="mb-4 text-base font-medium text-text-primary">Activity Log</h2>
        <p className="text-sm text-text-muted">Loading...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <h2 className="mb-4 text-base font-medium text-text-primary">Activity Log</h2>
        <p className="text-sm text-red-400">{error}</p>
      </Card>
    )
  }

  return (
    <Card>
      <h2 className="mb-4 text-base font-medium text-text-primary">Activity Log</h2>

      {entries.length === 0 ? (
        <p className="text-sm text-text-muted">No activity recorded yet.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-text-muted">
                  <th className="pb-2 pr-4 font-medium">Timestamp</th>
                  <th className="pb-2 pr-4 font-medium">Action</th>
                  <th className="pb-2 pr-4 font-medium">Resource</th>
                  <th className="pb-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4 font-mono text-xs text-text-secondary">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant={actionBadgeVariant(entry.action)}>
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-4 text-text-secondary">
                      {RESOURCE_LABELS[entry.resource_type] ?? entry.resource_type}
                    </td>
                    <td className="max-w-xs truncate py-2.5 font-mono text-xs text-text-muted">
                      {formatDetails(entry)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="mt-4 text-center">
              <Button variant="secondary" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load More'}
              </Button>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
