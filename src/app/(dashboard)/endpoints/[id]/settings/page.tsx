import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { EndpointForm } from '@/components/endpoints/endpoint-form'
import { DeleteEndpointButton } from '@/components/endpoints/delete-endpoint-button'
import { ToggleActiveButton } from '@/components/endpoints/toggle-active-button'
import { Badge } from '@/components/ui/badge'
import type { Endpoint } from '@/types'

interface EndpointSettingsPageProps {
  params: Promise<{ id: string }>
}

export default async function EndpointSettingsPage({ params }: EndpointSettingsPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.from('endpoints').select('*').eq('id', id).single()

  if (error || !data) {
    notFound()
  }

  const endpoint = data as Endpoint

  return (
    <div>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-text-primary">Endpoint Settings</h1>
        <Badge variant={endpoint.is_active ? 'success' : 'warning'}>
          {endpoint.is_active ? 'Active' : 'Paused'}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-text-secondary">{endpoint.name}</p>

      <div className="mt-6 space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-text-primary">Status</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Paused endpoints will not accept incoming webhook requests.
          </p>
          <div className="mt-3">
            <ToggleActiveButton endpointId={endpoint.id} isActive={endpoint.is_active} />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary">Edit Endpoint</h2>
          <div className="mt-3">
            <EndpointForm mode="edit" endpoint={endpoint} />
          </div>
        </section>

        <section className="rounded-lg border border-red-500/20 p-5">
          <h2 className="text-lg font-semibold text-red-400">Danger Zone</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Deleting an endpoint is permanent. All captured requests will also be deleted.
          </p>
          <div className="mt-3">
            <DeleteEndpointButton endpointId={endpoint.id} endpointName={endpoint.name} />
          </div>
        </section>
      </div>
    </div>
  )
}
