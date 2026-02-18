import { EndpointForm } from '@/components/endpoints/endpoint-form'

export default function NewEndpointPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary">New Endpoint</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Configure a new webhook endpoint to start capturing requests.
      </p>
      <div className="mt-6">
        <EndpointForm mode="create" />
      </div>
    </div>
  )
}
