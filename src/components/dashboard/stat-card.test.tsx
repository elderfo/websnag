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
    expect(progressBar).toHaveAttribute('aria-label', 'Requests')
  })

  it('renders red progress bar when progress > 80', () => {
    render(<StatCard label="Usage" value="90" progress={90} />)
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveClass('bg-red-500')
  })

  it('renders yellow progress bar when progress > 50', () => {
    render(<StatCard label="Usage" value="65" progress={65} />)
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveClass('bg-yellow-500')
  })

  it('renders accent progress bar when progress <= 50', () => {
    render(<StatCard label="Usage" value="30" progress={30} />)
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveClass('bg-accent')
  })

  it('renders progress bar with progress={0}', () => {
    render(<StatCard label="Usage" value="0" progress={0} />)
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toBeInTheDocument()
    expect(progressBar).toHaveAttribute('aria-valuenow', '0')
  })

  it('clamps progress values outside 0-100', () => {
    render(<StatCard label="Usage" value="200" progress={150} />)
    const progressBar = screen.getByRole('progressbar')
    expect(progressBar).toHaveAttribute('aria-valuenow', '100')
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
