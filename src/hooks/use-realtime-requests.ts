'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { WebhookRequest } from '@/types'

export function useRealtimeRequests(endpointId: string) {
  const [requests, setRequests] = useState<WebhookRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    // Initial fetch
    async function fetchRequests() {
      const { data } = await supabase
        .from('requests')
        .select('*')
        .eq('endpoint_id', endpointId)
        .order('received_at', { ascending: false })
        .limit(50)

      if (data) setRequests(data as WebhookRequest[])
      setLoading(false)
    }

    fetchRequests()

    // Realtime subscription
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
          setRequests((prev) => [payload.new as WebhookRequest, ...prev])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [endpointId])

  return { requests, loading }
}
