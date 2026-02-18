import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DashboardPage from './page'

function getFirst(text: string | RegExp) {
  return screen.getAllByText(text)[0]
}

describe('DashboardPage', () => {
  it('renders the page heading', () => {
    render(<DashboardPage />)
    const headings = screen.getAllByRole('heading', { level: 1 })
    expect(headings[0]).toHaveTextContent('Your Endpoints')
  })

  it('renders the empty state message', () => {
    render(<DashboardPage />)
    expect(getFirst('No endpoints yet.')).toBeInTheDocument()
  })
})
