import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BulkActions } from './bulk-actions'

const defaultProps = {
  selectedCount: 3,
  onDelete: vi.fn().mockResolvedValue(undefined),
  onExport: vi.fn(),
  onSelectAll: vi.fn(),
  onClearSelection: vi.fn(),
  allSelected: false,
}

describe('BulkActions', () => {
  it('renders with correct selected count', () => {
    render(<BulkActions {...defaultProps} />)
    expect(screen.getByText('3 selected')).toBeInTheDocument()
  })

  it('renders nothing when selectedCount is 0', () => {
    const { container } = render(<BulkActions {...defaultProps} selectedCount={0} />)
    expect(container.firstChild).toBeNull()
  })

  it('"Delete selected" button opens confirm dialog', async () => {
    const user = userEvent.setup()
    render(<BulkActions {...defaultProps} />)
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Delete requests')).toBeInTheDocument()
  })

  it('confirm delete calls onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<BulkActions {...defaultProps} onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledOnce()
  })

  it('cancel closes dialog without deleting', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    render(<BulkActions {...defaultProps} onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(onDelete).not.toHaveBeenCalled()
  })

  it('export button calls onExport', async () => {
    const onExport = vi.fn()
    const user = userEvent.setup()
    render(<BulkActions {...defaultProps} onExport={onExport} />)
    await user.click(screen.getByRole('button', { name: 'Export selected' }))
    expect(onExport).toHaveBeenCalledOnce()
  })

  it('shows "Select all on page" when not all selected', () => {
    render(<BulkActions {...defaultProps} allSelected={false} />)
    expect(screen.getByRole('button', { name: 'Select all on page' })).toBeInTheDocument()
  })

  it('shows "Clear selection" when all selected', () => {
    render(<BulkActions {...defaultProps} allSelected={true} />)
    expect(screen.getByRole('button', { name: 'Clear selection' })).toBeInTheDocument()
  })

  it('shows error message when delete fails', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('Network error'))
    const user = userEvent.setup()
    render(<BulkActions {...defaultProps} onDelete={onDelete} />)
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByText('Failed to delete requests. Please try again.')).toBeInTheDocument()
  })
})
