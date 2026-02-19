import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/usage'
import { EndpointForm } from '@/components/endpoints/endpoint-form'

export default async function NewEndpointPage() {
  const supabase = await createClient()

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .single()

  const isPro = getUserPlan(subscription) === 'pro'

  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary">New Endpoint</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Configure a new webhook endpoint to start capturing requests.
      </p>
      <div className="mt-6">
        <EndpointForm mode="create" isPro={isPro} />
      </div>
    </div>
  )
}
