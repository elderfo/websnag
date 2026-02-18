import { describe, it, expect } from 'vitest'
import { generateSlug, isValidCustomSlug } from '@/lib/utils'

describe('generateSlug', () => {
  it('returns a string of 12 characters', () => {
    const slug = generateSlug()
    expect(slug).toHaveLength(12)
  })

  it('only contains valid characters (lowercase + digits, no ambiguous)', () => {
    const validChars = 'abcdefghijkmnopqrstuvwxyz23456789'
    for (let i = 0; i < 50; i++) {
      const slug = generateSlug()
      for (const char of slug) {
        expect(validChars).toContain(char)
      }
    }
  })

  it('generates unique slugs', () => {
    const slugs = new Set<string>()
    for (let i = 0; i < 100; i++) {
      slugs.add(generateSlug())
    }
    expect(slugs.size).toBe(100)
  })
})

describe('isValidCustomSlug', () => {
  it('accepts valid slugs', () => {
    expect(isValidCustomSlug('my-webhook')).toBe(true)
    expect(isValidCustomSlug('abc')).toBe(true)
    expect(isValidCustomSlug('a1b2c3')).toBe(true)
    expect(isValidCustomSlug('my-cool-webhook-endpoint')).toBe(true)
    expect(isValidCustomSlug('test123')).toBe(true)
  })

  it('rejects slugs that are too short (less than 3 chars)', () => {
    expect(isValidCustomSlug('ab')).toBe(false)
    expect(isValidCustomSlug('a')).toBe(false)
    expect(isValidCustomSlug('')).toBe(false)
  })

  it('rejects slugs that are too long (more than 48 chars)', () => {
    const longSlug = 'a'.repeat(49)
    expect(isValidCustomSlug(longSlug)).toBe(false)
  })

  it('accepts slugs at exactly 3 and 48 chars', () => {
    expect(isValidCustomSlug('abc')).toBe(true)
    expect(isValidCustomSlug('a'.repeat(48))).toBe(true)
  })

  it('rejects slugs with leading hyphens', () => {
    expect(isValidCustomSlug('-my-webhook')).toBe(false)
  })

  it('rejects slugs with trailing hyphens', () => {
    expect(isValidCustomSlug('my-webhook-')).toBe(false)
  })

  it('rejects slugs with uppercase characters', () => {
    expect(isValidCustomSlug('My-Webhook')).toBe(false)
    expect(isValidCustomSlug('UPPERCASE')).toBe(false)
  })

  it('rejects slugs with spaces', () => {
    expect(isValidCustomSlug('my webhook')).toBe(false)
  })

  it('rejects slugs with special characters', () => {
    expect(isValidCustomSlug('my_webhook')).toBe(false)
    expect(isValidCustomSlug('my.webhook')).toBe(false)
    expect(isValidCustomSlug('my@webhook')).toBe(false)
    expect(isValidCustomSlug('my!webhook')).toBe(false)
  })
})
