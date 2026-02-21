import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VolumeChart } from './volume-chart'

describe('VolumeChart', () => {
  it('renders empty state when data is empty', () => {
    render(<VolumeChart data={[]} />)
    expect(screen.getByText('No request data for this period')).toBeInTheDocument()
  })

  it('renders the chart heading', () => {
    render(<VolumeChart data={[{ date: '2026-02-20', count: 5 }]} />)
    expect(screen.getByText('Request Volume')).toBeInTheDocument()
  })

  it('renders total requests count', () => {
    render(
      <VolumeChart
        data={[
          { date: '2026-02-19', count: 3 },
          { date: '2026-02-20', count: 7 },
        ]}
      />
    )
    expect(screen.getByText('10 total requests')).toBeInTheDocument()
  })

  it('renders an SVG with role img', () => {
    const { container } = render(<VolumeChart data={[{ date: '2026-02-20', count: 1 }]} />)
    const svg = container.querySelector('svg[role="img"]')
    expect(svg).toBeInTheDocument()
  })

  it('renders bars for each data point', () => {
    const data = [
      { date: '2026-02-18', count: 2 },
      { date: '2026-02-19', count: 5 },
      { date: '2026-02-20', count: 1 },
    ]
    const { container } = render(<VolumeChart data={data} />)
    // Each data point gets a <g> with role="graphics-symbol"
    const bars = container.querySelectorAll('[role="graphics-symbol"]')
    expect(bars.length).toBe(3)
  })

  it('handles single data point gracefully', () => {
    render(<VolumeChart data={[{ date: '2026-02-20', count: 100 }]} />)
    expect(screen.getByText('100 total requests')).toBeInTheDocument()
  })

  it('handles all-zero counts', () => {
    const data = [
      { date: '2026-02-19', count: 0 },
      { date: '2026-02-20', count: 0 },
    ]
    render(<VolumeChart data={data} />)
    expect(screen.getByText('0 total requests')).toBeInTheDocument()
  })
})
