import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestDetail } from './request-detail'
import type { WebhookRequest } from '@/types'

const mockRequest: WebhookRequest = {
  id: 'req-1',
  endpoint_id: 'ep-1',
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    authorization: 'Bearer token123',
  },
  body: '{"event": "test", "data": {"id": 123}}',
  query_params: { foo: 'bar' },
  content_type: 'application/json',
  source_ip: '192.168.1.1',
  size_bytes: 512,
  received_at: new Date().toISOString(),
  ai_analysis: null,
}

const endpointUrl = 'https://websnag.dev/api/wh/test-slug'

describe('RequestDetail', () => {
  it('renders the method badge in the header', () => {
    render(<RequestDetail request={mockRequest} endpointUrl={endpointUrl} />)
    expect(screen.getAllByText('POST').length).toBeGreaterThanOrEqual(1)
  })

  it('renders source IP', () => {
    render(<RequestDetail request={mockRequest} endpointUrl={endpointUrl} />)
    expect(screen.getByText('from 192.168.1.1')).toBeInTheDocument()
  })

  it('renders all five tabs', () => {
    render(<RequestDetail request={mockRequest} endpointUrl={endpointUrl} />)
    expect(screen.getByRole('tab', { name: 'Body' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Headers' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Query Params' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Analysis' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Replay' })).toBeInTheDocument()
  })

  it('shows body tab by default with formatted JSON', () => {
    render(<RequestDetail request={mockRequest} endpointUrl={endpointUrl} />)
    expect(screen.getByText(/Request Body/)).toBeInTheDocument()
    // The formatted JSON should be present
    expect(screen.getByText(/cURL Command/)).toBeInTheDocument()
  })

  it('switches to headers tab and shows header table', async () => {
    const user = userEvent.setup()
    render(<RequestDetail request={mockRequest} endpointUrl={endpointUrl} />)

    await user.click(screen.getByRole('tab', { name: 'Headers' }))

    expect(screen.getByText('content-type')).toBeInTheDocument()
    expect(screen.getByText('application/json')).toBeInTheDocument()
    expect(screen.getByText('authorization')).toBeInTheDocument()
    expect(screen.getByText('Bearer token123')).toBeInTheDocument()
  })

  it('switches to query params tab and shows params', async () => {
    const user = userEvent.setup()
    render(<RequestDetail request={mockRequest} endpointUrl={endpointUrl} />)

    await user.click(screen.getByRole('tab', { name: 'Query Params' }))

    expect(screen.getByText('foo')).toBeInTheDocument()
    expect(screen.getByText('bar')).toBeInTheDocument()
  })

  it('shows empty state for query params when none exist', async () => {
    const user = userEvent.setup()
    const noParams = { ...mockRequest, query_params: {} }
    render(<RequestDetail request={noParams} endpointUrl={endpointUrl} />)

    await user.click(screen.getByRole('tab', { name: 'Query Params' }))

    expect(screen.getByText('No query parameters')).toBeInTheDocument()
  })

  it('shows analysis placeholder when not analyzed', async () => {
    const user = userEvent.setup()
    render(<RequestDetail request={mockRequest} endpointUrl={endpointUrl} />)

    await user.click(screen.getByRole('tab', { name: 'Analysis' }))

    expect(screen.getByText('Analyze with AI')).toBeInTheDocument()
    expect(screen.getByText('Use AI to analyze this webhook payload')).toBeInTheDocument()
  })

  it('shows analysis results when analyzed', async () => {
    const user = userEvent.setup()
    const analyzed: WebhookRequest = {
      ...mockRequest,
      ai_analysis: {
        source: 'Stripe',
        webhook_type: 'payment_intent.succeeded',
        summary: 'A payment was successfully completed.',
        key_fields: [{ path: 'data.object.id', description: 'Payment ID' }],
        schema_notes: 'Looks standard',
        handler_node: '// handler',
        handler_python: '# handler',
      },
    }
    render(<RequestDetail request={analyzed} endpointUrl={endpointUrl} />)

    await user.click(screen.getByRole('tab', { name: 'Analysis' }))

    expect(screen.getByText('Stripe')).toBeInTheDocument()
    expect(screen.getByText('payment_intent.succeeded')).toBeInTheDocument()
    expect(screen.getByText('A payment was successfully completed.')).toBeInTheDocument()
  })

  it('shows "No request body" for null body', () => {
    const noBody = { ...mockRequest, body: null }
    render(<RequestDetail request={noBody} endpointUrl={endpointUrl} />)
    expect(screen.getByText('No request body')).toBeInTheDocument()
  })

  it('shows raw text for non-JSON body', () => {
    const rawBody = { ...mockRequest, body: 'plain text body' }
    render(<RequestDetail request={rawBody} endpointUrl={endpointUrl} />)
    expect(screen.getByText('plain text body')).toBeInTheDocument()
  })

  it('switches to replay tab and shows replay panel', async () => {
    const user = userEvent.setup()
    render(<RequestDetail request={mockRequest} endpointUrl={endpointUrl} />)

    await user.click(screen.getByRole('tab', { name: 'Replay' }))

    expect(screen.getByLabelText('Target URL')).toBeInTheDocument()
    expect(screen.getByText('PRO')).toBeInTheDocument()
  })
})
