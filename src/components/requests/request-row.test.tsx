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

const defaultProps = {
  isSelected: false,
  isChecked: false,
  showCheckbox: false,
  onSelect: () => {},
  onCheckChange: vi.fn(),
}

describe('RequestRow', () => {
  it('renders method badge', () => {
    render(<RequestRow request={mockRequest} {...defaultProps} />)
    expect(screen.getByText('POST')).toBeInTheDocument()
  })

  it('renders content type', () => {
    render(<RequestRow request={mockRequest} {...defaultProps} />)
    expect(screen.getByText('application/json')).toBeInTheDocument()
  })

  it('renders formatted size', () => {
    render(<RequestRow request={mockRequest} {...defaultProps} />)
    expect(screen.getByText('1.2 KB')).toBeInTheDocument()
  })

  it('shows gray dot when not analyzed', () => {
    render(<RequestRow request={mockRequest} {...defaultProps} />)
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
    render(<RequestRow request={analyzed} {...defaultProps} />)
    const dot = screen.getByTitle('AI analyzed')
    expect(dot.className).toContain('bg-green-400')
  })

  it('calls onSelect when clicked', async () => {
    const onSelect = vi.fn()
    const user = userEvent.setup()
    render(<RequestRow request={mockRequest} {...defaultProps} onSelect={onSelect} />)
    await user.click(screen.getByRole('button'))
    expect(onSelect).toHaveBeenCalledWith(mockRequest)
  })

  it('applies selected styling when isSelected is true', () => {
    render(<RequestRow request={mockRequest} {...defaultProps} isSelected={true} />)
    const container = screen.getByRole('button').closest('div')
    expect(container!.className).toContain('border-l-accent')
  })

  it('shows "no content-type" when content_type is null', () => {
    const noContentType = { ...mockRequest, content_type: null }
    render(<RequestRow request={noContentType} {...defaultProps} />)
    expect(screen.getByText('no content-type')).toBeInTheDocument()
  })

  it('shows checkbox when showCheckbox is true', () => {
    render(<RequestRow request={mockRequest} {...defaultProps} showCheckbox={true} />)
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('does not show checkbox when showCheckbox is false', () => {
    render(<RequestRow request={mockRequest} {...defaultProps} showCheckbox={false} />)
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('calls onCheckChange when checkbox is toggled', async () => {
    const onCheckChange = vi.fn()
    const user = userEvent.setup()
    render(
      <RequestRow
        request={mockRequest}
        {...defaultProps}
        showCheckbox={true}
        onCheckChange={onCheckChange}
      />
    )
    await user.click(screen.getByRole('checkbox'))
    expect(onCheckChange).toHaveBeenCalledWith('req-1', true)
  })
})
