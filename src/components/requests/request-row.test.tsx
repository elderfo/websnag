import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RequestRow } from './request-row'
import type { WebhookRequest } from '@/types'

const mockRequest: WebhookRequest = {
  id: 'req-1',
  endpoint_id: 'ep-1',
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: '{"test": true}',
  query_params: {},
  content_type: 'application/json',
  source_ip: '127.0.0.1',
  size_bytes: 1234,
  received_at: new Date().toISOString(),
  ai_analysis: null,
}

describe('RequestRow', () => {
  it('renders method badge', () => {
    render(<RequestRow request={mockRequest} isSelected={false} onSelect={() => {}} />)
    expect(screen.getByText('POST')).toBeInTheDocument()
  })

  it('renders content type', () => {
    render(<RequestRow request={mockRequest} isSelected={false} onSelect={() => {}} />)
    expect(screen.getByText('application/json')).toBeInTheDocument()
  })

  it('renders formatted size', () => {
    render(<RequestRow request={mockRequest} isSelected={false} onSelect={() => {}} />)
    expect(screen.getByText('1.2 KB')).toBeInTheDocument()
  })

  it('shows gray dot when not analyzed', () => {
    render(<RequestRow request={mockRequest} isSelected={false} onSelect={() => {}} />)
    const dot = screen.getByTitle('Not analyzed')
    expect(dot.className).toContain('bg-white/20')
  })

  it('shows green dot when analyzed', () => {
    const analyzed = {
      ...mockRequest,
      ai_analysis: {
        source: 'Test',
        webhook_type: 'test',
        summary: 'A test',
        key_fields: [],
        schema_notes: '',
        handler_node: '',
        handler_python: '',
      },
    }
    render(<RequestRow request={analyzed} isSelected={false} onSelect={() => {}} />)
    const dot = screen.getByTitle('AI analyzed')
    expect(dot.className).toContain('bg-green-400')
  })

  it('calls onSelect when clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<RequestRow request={mockRequest} isSelected={false} onSelect={onSelect} />)
    await user.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith(mockRequest)
  })

  it('applies selected styling when isSelected is true', () => {
    render(<RequestRow request={mockRequest} isSelected={true} onSelect={() => {}} />)
    const button = screen.getByRole('button')
    expect(button.className).toContain('border-l-accent')
  })

  it('shows "no content-type" when content_type is null', () => {
    const noContentType = { ...mockRequest, content_type: null }
    render(<RequestRow request={noContentType} isSelected={false} onSelect={() => {}} />)
    expect(screen.getByText('no content-type')).toBeInTheDocument()
  })
})
