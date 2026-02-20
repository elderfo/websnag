import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getUserPlan } from '@/lib/usage'
import { EndpointForm } from '@/components/endpoints/endpoint-form'

export default async function NewEndpointPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [subscriptionResult, profileResult] = await Promise.all([
    supabase.from('subscriptions').select('plan, status').single(),
    supabase.from('profiles').select('username').eq('id', user!.id).maybeSingle(),
  ])

  const isPro = getUserPlan(subscriptionResult.data) === 'pro'
  const hasUsername = !!profileResult.data?.username

  if (!hasUsername) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-text-primary">New Endpoint</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Configure a new webhook endpoint to start capturing requests.
        </p>
        <div className="mt-8 rounded-lg border border-border bg-surface p-8 text-center">
          <p className="text-base font-medium text-text-primary">Username required</p>
          <p className="mt-2 text-sm text-text-secondary">
            You need to set a username before creating endpoints. Your username becomes part of your
            webhook URL:{' '}
            <span className="font-mono text-text-muted">
              websnag.dev/wh/<span className="text-accent">your-username</span>/slug
            </span>
          </p>
          <Link
            href="/settings?setup=username&redirect=/endpoints/new"
            className="mt-6 inline-flex items-center justify-center rounded-md bg-accent px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-accent-hover"
          >
            Set username
          </Link>
        </div>
      </div>
    )
  }

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
