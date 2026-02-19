import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { EndpointCard } from '@/components/endpoints/endpoint-card'
import type { Endpoint } from '@/types'

export default async function EndpointsPage() {
  const supabase = await createClient()

  const { data: endpoints, error } = await supabase
    .from('endpoints')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    throw error
  }

  const endpointList = (endpoints ?? []) as Endpoint[]

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Endpoints</h1>
          <p className="mt-1 text-sm text-text-secondary">Manage your webhook endpoints.</p>
        </div>
        <Link
          href="/endpoints/new"
          className="inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-accent-hover"
        >
          New Endpoint
        </Link>
      </div>

      {endpointList.length === 0 ? (
        <div className="mt-12 rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-lg font-medium text-text-primary">No endpoints yet</p>
          <p className="mt-2 text-sm text-text-muted">
            Create your first webhook endpoint to start capturing and inspecting requests.
          </p>
          <Link
            href="/endpoints/new"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-accent-hover"
          >
            Create your first endpoint
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {endpointList.map((endpoint) => (
            <EndpointCard key={endpoint.id} endpoint={endpoint} />
          ))}
        </div>
      )}
    </div>
  )
}
