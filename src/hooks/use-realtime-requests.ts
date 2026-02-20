'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WebhookRequest, RequestFilters } from '@/types'

const PAGE_SIZE = 50

function matchesFilters(request: WebhookRequest, filters: RequestFilters): boolean {
  if (filters.method && request.method !== filters.method) return false
  if (filters.dateFrom && request.received_at < filters.dateFrom) return false
  if (filters.dateTo && request.received_at > filters.dateTo) return false
  if (filters.search && !(request.body ?? '').toLowerCase().includes(filters.search.toLowerCase())) {
    return false
  }
  return true
}

export function useRealtimeRequests(endpointId: string, filters: RequestFilters = {}) {
  const [requests, setRequests] = useState<WebhookRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  // Fetch with current filters
  const fetchRequests = useCallback(
    async (cursor?: string) => {
      const supabase = createClient()

      let query = supabase
        .from('requests')
        .select('*')
        .eq('endpoint_id', endpointId)
        .order('received_at', { ascending: false })
        .limit(PAGE_SIZE + 1) // Fetch one extra to detect hasMore

      if (filters.method) {
        query = query.eq('method', filters.method)
      }
      if (filters.dateFrom) {
        query = query.gte('received_at', filters.dateFrom)
      }
      if (filters.dateTo) {
        query = query.lte('received_at', filters.dateTo)
      }
      if (filters.search) {
        query = query.ilike('body', `%${filters.search}%`)
      }
      if (cursor) {
        query = query.lt('received_at', cursor)
      }

      const { data } = await query

      if (data) {
        const hasNextPage = data.length > PAGE_SIZE
        const pageData = hasNextPage ? data.slice(0, PAGE_SIZE) : data
        return { requests: pageData as WebhookRequest[], hasMore: hasNextPage }
      }

      return { requests: [], hasMore: false }
    },
    [endpointId, filters.method, filters.dateFrom, filters.dateTo, filters.search]
  )

  // Initial fetch (resets on filter change)
  useEffect(() => {
    let cancelled = false

    fetchRequests().then(({ requests: data, hasMore: more }) => {
      if (cancelled) return
      setLoading(false)
      setRequests(data)
      setHasMore(more)
    })

    return () => {
      cancelled = true
    }
  }, [fetchRequests])

  // Load more (next page)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || requests.length === 0) return

    setLoadingMore(true)
    const lastRequest = requests[requests.length - 1]
    const { requests: nextPage, hasMore: more } = await fetchRequests(lastRequest.received_at)

    setRequests((prev) => [...prev, ...nextPage])
    setHasMore(more)
    setLoadingMore(false)
  }, [loadingMore, hasMore, requests, fetchRequests])

  // Realtime subscription (unfiltered — new requests always arrive)
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`endpoint-${endpointId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'requests',
          filter: `endpoint_id=eq.${endpointId}`,
        },
        (payload) => {
          const newRequest = payload.new as WebhookRequest
          // Only prepend if it matches current filters
          if (matchesFilters(newRequest, filters)) {
            setRequests((prev) => [newRequest, ...prev])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [endpointId, filters])

  // Remove a request from local state (after delete)
  const removeRequest = useCallback((id: string) => {
    setRequests((prev) => prev.filter((r) => r.id !== id))
  }, [])

  const removeRequests = useCallback((ids: string[]) => {
    const idSet = new Set(ids)
    setRequests((prev) => prev.filter((r) => !idSet.has(r.id)))
  }, [])

  return { requests, loading, hasMore, loadingMore, loadMore, removeRequest, removeRequests }
}
