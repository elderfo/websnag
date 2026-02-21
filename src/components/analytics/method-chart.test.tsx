import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MethodChart } from './method-chart'

describe('MethodChart', () => {
  it('renders empty state when data is empty', () => {
    render(<MethodChart data={[]} />)
    expect(screen.getByText('No request data for this period')).toBeInTheDocument()
  })

  it('renders the chart heading', () => {
    render(<MethodChart data={[{ method: 'POST', count: 5 }]} />)
    expect(screen.getByText('Method Breakdown')).toBeInTheDocument()
  })

  it('renders method count label', () => {
    render(<MethodChart data={[{ method: 'POST', count: 5 }]} />)
    expect(screen.getByText('1 method')).toBeInTheDocument()
  })

  it('pluralizes method count correctly', () => {
    render(
      <MethodChart
        data={[
          { method: 'POST', count: 5 },
          { method: 'GET', count: 3 },
        ]}
      />
    )
    expect(screen.getByText('2 methods')).toBeInTheDocument()
  })

  it('renders method names', () => {
    render(
      <MethodChart
        data={[
          { method: 'POST', count: 10 },
          { method: 'GET', count: 5 },
          { method: 'DELETE', count: 2 },
        ]}
      />
    )
    expect(screen.getByText('POST')).toBeInTheDocument()
    expect(screen.getByText('GET')).toBeInTheDocument()
    expect(screen.getByText('DELETE')).toBeInTheDocument()
  })

  it('renders request counts', () => {
    render(<MethodChart data={[{ method: 'POST', count: 42 }]} />)
    expect(screen.getByText(/42/)).toBeInTheDocument()
  })

  it('renders percentage values', () => {
    render(
      <MethodChart
        data={[
          { method: 'POST', count: 75 },
          { method: 'GET', count: 25 },
        ]}
      />
    )
    expect(screen.getByText('(75.0%)')).toBeInTheDocument()
    expect(screen.getByText('(25.0%)')).toBeInTheDocument()
  })

  it('has accessible role="img" on the container', () => {
    const { container } = render(<MethodChart data={[{ method: 'POST', count: 1 }]} />)
    const chart = container.querySelector('[role="img"]')
    expect(chart).toBeInTheDocument()
  })
})
