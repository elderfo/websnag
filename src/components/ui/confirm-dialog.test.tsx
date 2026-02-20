import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConfirmDialog } from './confirm-dialog'

const defaultProps = {
  open: true,
  title: 'Confirm action',
  message: 'Are you sure you want to proceed?',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
}

describe('ConfirmDialog', () => {
  it('renders title and message when open', () => {
    render(<ConfirmDialog {...defaultProps} />)
    expect(screen.getByText('Confirm action')).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument()
  })

  it('does not render when not open', () => {
    render(<ConfirmDialog {...defaultProps} open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Confirm action')).not.toBeInTheDocument()
  })

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn()
    const user = userEvent.setup()
    render(<ConfirmDialog {...defaultProps} onConfirm={onConfirm} />)
    await user.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when Escape key is pressed', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('calls onCancel when overlay is clicked', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    const { container } = render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)
    // Click the overlay (outer fixed div), not the dialog content
    const overlay = container.firstChild as HTMLElement
    await user.click(overlay)
    expect(onCancel).toHaveBeenCalledOnce()
  })

  it('does not call onCancel when clicking inside dialog content', async () => {
    const onCancel = vi.fn()
    const user = userEvent.setup()
    render(<ConfirmDialog {...defaultProps} onCancel={onCancel} />)
    await user.click(screen.getByRole('dialog'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('renders custom confirmLabel', () => {
    render(<ConfirmDialog {...defaultProps} confirmLabel="Delete" />)
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('shows "Processing..." and disables confirm when loading', () => {
    render(<ConfirmDialog {...defaultProps} loading={true} />)
    const confirmBtn = screen.getByRole('button', { name: 'Processing...' })
    expect(confirmBtn).toBeDisabled()
  })

  it('disables cancel button when loading', () => {
    render(<ConfirmDialog {...defaultProps} loading={true} />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
  })

  it('has correct ARIA attributes', () => {
    render(<ConfirmDialog {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-dialog-title')
    expect(dialog).toHaveAttribute('aria-describedby', 'confirm-dialog-message')
  })
})
