import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AnalysisDisplay } from './analysis-display'
import type { AiAnalysis } from '@/types'

const mockAnalysis: AiAnalysis = {
  source: 'Stripe',
  webhook_type: 'payment_intent.succeeded',
  summary: 'A payment intent has been successfully completed.',
  key_fields: [
    { path: 'data.object.id', description: 'Payment intent ID' },
    { path: 'data.object.amount', description: 'Amount in cents' },
  ],
  schema_notes: 'Looks standard',
  handler_node: '// node handler',
  handler_python: '# python handler',
}

describe('AnalysisDisplay', () => {
  it('renders source badge', () => {
    render(<AnalysisDisplay analysis={mockAnalysis} />)
    expect(screen.getByText('Stripe')).toBeInTheDocument()
  })

  it('renders webhook type', () => {
    render(<AnalysisDisplay analysis={mockAnalysis} />)
    expect(screen.getByText('payment_intent.succeeded')).toBeInTheDocument()
  })

  it('renders summary', () => {
    render(<AnalysisDisplay analysis={mockAnalysis} />)
    expect(
      screen.getByText('A payment intent has been successfully completed.')
    ).toBeInTheDocument()
  })

  it('renders key fields table', () => {
    render(<AnalysisDisplay analysis={mockAnalysis} />)
    expect(screen.getByText('data.object.id')).toBeInTheDocument()
    expect(screen.getByText('Payment intent ID')).toBeInTheDocument()
    expect(screen.getByText('data.object.amount')).toBeInTheDocument()
    expect(screen.getByText('Amount in cents')).toBeInTheDocument()
  })

  it('renders schema notes', () => {
    render(<AnalysisDisplay analysis={mockAnalysis} />)
    expect(screen.getByText('Looks standard')).toBeInTheDocument()
  })

  it('handles empty key fields', () => {
    const analysisNoFields = { ...mockAnalysis, key_fields: [] }
    render(<AnalysisDisplay analysis={analysisNoFields} />)
    expect(screen.queryByText('Path')).not.toBeInTheDocument()
  })

  it('applies Stripe source color', () => {
    render(<AnalysisDisplay analysis={mockAnalysis} />)
    const badge = screen.getByText('Stripe')
    expect(badge.className).toContain('text-purple-400')
  })

  it('applies default color for unknown source', () => {
    const unknownSource = { ...mockAnalysis, source: 'CustomService' }
    render(<AnalysisDisplay analysis={unknownSource} />)
    const badge = screen.getByText('CustomService')
    expect(badge.className).toContain('text-accent')
  })
})
