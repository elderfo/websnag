import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from './stat-card'

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Requests" value="42" />)
    expect(screen.getByText('Requests')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders subtitle when provided', () => {
    render(<StatCard label="Requests" value="42" subtitle="this month" />)
    expect(screen.getByText('this month')).toBeInTheDocument()
  })

  it('renders progress bar when progress is provided', () => {
    render(<StatCard label="Requests" value="42" progress={65} />)
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toBeInTheDocument()
    expect(progressBar).toHaveAttribute('aria-valuenow', '65')
    expect(progressBar).toHaveAttribute('aria-valuemin', '0')
    expect(progressBar).toHaveAttribute('aria-valuemax', '100')
  })

  it('does NOT render progress bar when progress is not provided', () => {
    render(<StatCard label="Requests" value="42" />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('renders children when provided', () => {
    render(
      <StatCard label="Requests" value="42">
        <span>Extra content</span>
      </StatCard>
    )
    expect(screen.getByText('Extra content')).toBeInTheDocument()
  })
})
