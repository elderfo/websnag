export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-text-primary">Your Endpoints</h1>
      <p className="mt-2 text-text-secondary">
        Create a webhook endpoint to start capturing requests.
      </p>

      <div className="mt-8 rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-text-muted">No endpoints yet.</p>
        <p className="mt-1 text-sm text-text-muted">Endpoints will appear here once created.</p>
      </div>
    </div>
  )
}
