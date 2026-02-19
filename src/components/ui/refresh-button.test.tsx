import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockRefresh = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: mockRefresh }),
}))

import { RefreshButton } from './refresh-button'

describe('RefreshButton', () => {
  it('renders a button with aria-label "Refresh"', () => {
    render(<RefreshButton />)
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })

  it('calls router.refresh() when clicked', async () => {
    render(<RefreshButton />)
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(mockRefresh).toHaveBeenCalled()
  })
})
