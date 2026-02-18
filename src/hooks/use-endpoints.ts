'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Endpoint } from '@/types'

export function useEndpoints() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchEndpoints() {
      const supabase = createClient()
      const { data } = await supabase
        .from('endpoints')
        .select('*')
        .order('created_at', { ascending: false })

      if (data) setEndpoints(data as Endpoint[])
      setLoading(false)
    }

    fetchEndpoints()
  }, [])

  return { endpoints, loading }
}
