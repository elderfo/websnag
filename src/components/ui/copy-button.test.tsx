import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CopyButton } from './copy-button'

describe('CopyButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    })
  })

  it('renders with default label', () => {
    render(<CopyButton text="test" />)
    expect(screen.getByRole('button', { name: 'Copy' })).toBeInTheDocument()
  })

  it('renders with custom label', () => {
    render(<CopyButton text="test" label="Copy URL" />)
    expect(screen.getByRole('button', { name: 'Copy URL' })).toBeInTheDocument()
  })

  it('copies text to clipboard on click', async () => {
    render(<CopyButton text="https://example.com" />)
    await userEvent.click(screen.getByRole('button'))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://example.com')
  })

  it('shows "Copied!" after clicking', async () => {
    render(<CopyButton text="test" />)
    await userEvent.click(screen.getByRole('button'))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copied!' })).toBeInTheDocument()
    })
  })
})
