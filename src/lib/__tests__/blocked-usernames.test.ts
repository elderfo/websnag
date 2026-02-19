import { describe, it, expect } from 'vitest'
import { isBlockedUsername, BLOCKED_USERNAMES } from '../blocked-usernames'

describe('isBlockedUsername', () => {
  it('returns true for known blocked names', () => {
    expect(isBlockedUsername('stripe')).toBe(true)
    expect(isBlockedUsername('github')).toBe(true)
    expect(isBlockedUsername('admin')).toBe(true)
    expect(isBlockedUsername('websnag')).toBe(true)
    expect(isBlockedUsername('api')).toBe(true)
    expect(isBlockedUsername('aws')).toBe(true)
    expect(isBlockedUsername('google')).toBe(true)
    expect(isBlockedUsername('shopify')).toBe(true)
    expect(isBlockedUsername('slack')).toBe(true)
    expect(isBlockedUsername('root')).toBe(true)
    expect(isBlockedUsername('null')).toBe(true)
    expect(isBlockedUsername('undefined')).toBe(true)
    expect(isBlockedUsername('www')).toBe(true)
    expect(isBlockedUsername('webhook')).toBe(true)
    expect(isBlockedUsername('webhooks')).toBe(true)
    expect(isBlockedUsername('support')).toBe(true)
    expect(isBlockedUsername('security')).toBe(true)
    expect(isBlockedUsername('billing')).toBe(true)
    expect(isBlockedUsername('payments')).toBe(true)
    expect(isBlockedUsername('official')).toBe(true)
    expect(isBlockedUsername('system')).toBe(true)
  })

  it('returns false for normal, valid usernames', () => {
    expect(isBlockedUsername('johndoe')).toBe(false)
    expect(isBlockedUsername('alice')).toBe(false)
    expect(isBlockedUsername('my-company')).toBe(false)
    expect(isBlockedUsername('dev-team')).toBe(false)
    expect(isBlockedUsername('acme-corp')).toBe(false)
    expect(isBlockedUsername('cooluser')).toBe(false)
    expect(isBlockedUsername('builder123')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(isBlockedUsername('STRIPE')).toBe(true)
    expect(isBlockedUsername('Stripe')).toBe(true)
    expect(isBlockedUsername('ADMIN')).toBe(true)
    expect(isBlockedUsername('Admin')).toBe(true)
    expect(isBlockedUsername('GitHub')).toBe(true)
    expect(isBlockedUsername('GITHUB')).toBe(true)
    expect(isBlockedUsername('WebSnag')).toBe(true)
    expect(isBlockedUsername('WEBSNAG')).toBe(true)
  })

  it('BLOCKED_USERNAMES set contains all expected categories', () => {
    // Cloud / infra
    expect(BLOCKED_USERNAMES.has('aws')).toBe(true)
    expect(BLOCKED_USERNAMES.has('vercel')).toBe(true)
    expect(BLOCKED_USERNAMES.has('cloudflare')).toBe(true)
    // Payment processors
    expect(BLOCKED_USERNAMES.has('stripe')).toBe(true)
    expect(BLOCKED_USERNAMES.has('paypal')).toBe(true)
    // Developer platforms
    expect(BLOCKED_USERNAMES.has('github')).toBe(true)
    expect(BLOCKED_USERNAMES.has('gitlab')).toBe(true)
    // E-commerce
    expect(BLOCKED_USERNAMES.has('shopify')).toBe(true)
    // Communication
    expect(BLOCKED_USERNAMES.has('slack')).toBe(true)
    expect(BLOCKED_USERNAMES.has('discord')).toBe(true)
    // Auth providers
    expect(BLOCKED_USERNAMES.has('auth0')).toBe(true)
    expect(BLOCKED_USERNAMES.has('okta')).toBe(true)
  })
})
