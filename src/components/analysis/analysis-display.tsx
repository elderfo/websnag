import type { AiAnalysis } from '@/types'

interface AnalysisDisplayProps {
  analysis: AiAnalysis
}

const SOURCE_COLORS: Record<string, string> = {
  Stripe: 'bg-purple-500/10 text-purple-400',
  GitHub: 'bg-gray-500/10 text-gray-300',
  Shopify: 'bg-green-500/10 text-green-400',
  Slack: 'bg-pink-500/10 text-pink-400',
  Twilio: 'bg-red-500/10 text-red-400',
}

function getSourceColor(source: string): string {
  return SOURCE_COLORS[source] ?? 'bg-accent/10 text-accent'
}

export function AnalysisDisplay({ analysis }: AnalysisDisplayProps) {
  return (
    <div className="space-y-5">
      {/* Source and type */}
      <div className="flex items-center gap-2 flex-wrap">
        <span
          className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-semibold ${getSourceColor(analysis.source)}`}
        >
          {analysis.source}
        </span>
        <span className="font-mono text-sm text-text-secondary">{analysis.webhook_type}</span>
      </div>

      {/* Summary */}
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5">
          Summary
        </h4>
        <p className="text-sm text-text-primary leading-relaxed">{analysis.summary}</p>
      </div>

      {/* Key fields */}
      {analysis.key_fields.length > 0 && (
        <div>
          <h4 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-2">
            Key Fields
          </h4>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface border-b border-border">
                  <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-muted">
                    Path
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-text-muted">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody>
                {analysis.key_fields.map((field) => (
                  <tr key={field.path} className="border-b border-border last:border-b-0">
                    <td className="px-4 py-2 font-mono text-xs text-accent whitespace-nowrap">
                      {field.path}
                    </td>
                    <td className="px-4 py-2 text-xs text-text-secondary">{field.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Schema notes */}
      <div>
        <h4 className="text-xs font-medium uppercase tracking-wider text-text-muted mb-1.5">
          Schema Notes
        </h4>
        <p className="text-sm text-text-secondary italic">{analysis.schema_notes}</p>
      </div>
    </div>
  )
}
