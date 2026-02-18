import { describe, it, expect } from 'vitest'
import { canCreateEndpoint, canReceiveRequest, canAnalyze, getUserPlan } from '@/lib/usage'

describe('canCreateEndpoint', () => {
  it('returns true when under the free limit', () => {
    expect(canCreateEndpoint(0, 'free')).toBe(true)
    expect(canCreateEndpoint(1, 'free')).toBe(true)
  })

  it('returns false when at the free limit', () => {
    expect(canCreateEndpoint(2, 'free')).toBe(false)
  })

  it('returns false when over the free limit', () => {
    expect(canCreateEndpoint(3, 'free')).toBe(false)
  })

  it('returns true for pro plan regardless of count', () => {
    expect(canCreateEndpoint(0, 'pro')).toBe(true)
    expect(canCreateEndpoint(100, 'pro')).toBe(true)
    expect(canCreateEndpoint(999999, 'pro')).toBe(true)
  })
})

describe('canReceiveRequest', () => {
  it('returns true when under the free limit', () => {
    expect(canReceiveRequest(0, 'free')).toBe(true)
    expect(canReceiveRequest(99, 'free')).toBe(true)
  })

  it('returns false when at the free limit', () => {
    expect(canReceiveRequest(100, 'free')).toBe(false)
  })

  it('returns false when over the free limit', () => {
    expect(canReceiveRequest(101, 'free')).toBe(false)
  })

  it('returns true for pro plan regardless of count', () => {
    expect(canReceiveRequest(0, 'pro')).toBe(true)
    expect(canReceiveRequest(100000, 'pro')).toBe(true)
  })
})

describe('canAnalyze', () => {
  it('returns true when under the free limit', () => {
    expect(canAnalyze(0, 'free')).toBe(true)
    expect(canAnalyze(4, 'free')).toBe(true)
  })

  it('returns false when at the free limit', () => {
    expect(canAnalyze(5, 'free')).toBe(false)
  })

  it('returns false when over the free limit', () => {
    expect(canAnalyze(6, 'free')).toBe(false)
  })

  it('returns true for pro plan regardless of count', () => {
    expect(canAnalyze(0, 'pro')).toBe(true)
    expect(canAnalyze(100000, 'pro')).toBe(true)
  })
})

describe('getUserPlan', () => {
  it('returns pro for active pro subscription', () => {
    expect(getUserPlan({ plan: 'pro', status: 'active' })).toBe('pro')
  })

  it('returns free for null subscription', () => {
    expect(getUserPlan(null)).toBe('free')
  })

  it('returns free for canceled pro subscription', () => {
    expect(getUserPlan({ plan: 'pro', status: 'canceled' })).toBe('free')
  })

  it('returns free for past_due pro subscription', () => {
    expect(getUserPlan({ plan: 'pro', status: 'past_due' })).toBe('free')
  })

  it('returns free for free plan subscription', () => {
    expect(getUserPlan({ plan: 'free', status: 'active' })).toBe('free')
  })

  it('returns free for trialing pro subscription', () => {
    expect(getUserPlan({ plan: 'pro', status: 'trialing' })).toBe('free')
  })
})
