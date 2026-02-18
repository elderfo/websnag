import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import Loading from './loading'

describe('Dashboard Loading', () => {
  it('renders skeleton elements', () => {
    const { container } = render(<Loading />)
    const pulsingElements = container.querySelectorAll('.animate-pulse')
    // 1 title skeleton + 3 card skeletons = 4
    expect(pulsingElements.length).toBe(4)
  })

  it('renders three card skeletons in a grid', () => {
    const { container } = render(<Loading />)
    const grid = container.querySelector('.grid')
    expect(grid).not.toBeNull()
    expect(grid?.children.length).toBe(3)
  })
})
