import { describe, it, expect } from 'vitest'
import { isSafeRedirectPath } from '@/lib/security'

describe('isSafeRedirectPath', () => {
  it('accepts a simple absolute path', () => {
    expect(isSafeRedirectPath('/dashboard')).toBe(true)
  })

  it('accepts root path', () => {
    expect(isSafeRedirectPath('/')).toBe(true)
  })

  it('accepts nested paths', () => {
    expect(isSafeRedirectPath('/endpoints/123/settings')).toBe(true)
  })

  it('accepts paths with query strings', () => {
    expect(isSafeRedirectPath('/search?q=test')).toBe(true)
  })

  it('accepts paths with hash fragments', () => {
    expect(isSafeRedirectPath('/docs#section')).toBe(true)
  })

  it('rejects empty string', () => {
    expect(isSafeRedirectPath('')).toBe(false)
  })

  it('rejects paths that do not start with /', () => {
    expect(isSafeRedirectPath('dashboard')).toBe(false)
    expect(isSafeRedirectPath('http://evil.com')).toBe(false)
  })

  it('rejects protocol-relative URLs (starts with //)', () => {
    expect(isSafeRedirectPath('//evil.com')).toBe(false)
    expect(isSafeRedirectPath('//evil.com/path')).toBe(false)
  })

  it('rejects paths containing backslashes', () => {
    expect(isSafeRedirectPath('/path\\evil')).toBe(false)
    expect(isSafeRedirectPath('\\evil')).toBe(false)
  })

  it('rejects paths containing carriage return (CRLF injection)', () => {
    expect(isSafeRedirectPath('/path\r\nSet-Cookie: evil=1')).toBe(false)
    expect(isSafeRedirectPath('/path\revil')).toBe(false)
    expect(isSafeRedirectPath('/path\nevil')).toBe(false)
  })

  it('rejects paths with only whitespace', () => {
    expect(isSafeRedirectPath('   ')).toBe(false)
  })
})
