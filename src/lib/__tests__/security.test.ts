import { describe, it, expect } from 'vitest'
import {
  isSafeRedirectPath,
  FORBIDDEN_RESPONSE_HEADERS,
  isAllowedResponseHeader,
} from '@/lib/security'

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

describe('FORBIDDEN_RESPONSE_HEADERS', () => {
  it('is a Set containing all required forbidden headers', () => {
    const expected = [
      'set-cookie',
      'location',
      'access-control-allow-origin',
      'access-control-allow-credentials',
      'access-control-allow-headers',
      'access-control-allow-methods',
      'content-security-policy',
      'strict-transport-security',
      'x-frame-options',
      'www-authenticate',
      'proxy-authenticate',
      'transfer-encoding',
      'connection',
      'upgrade',
    ]
    for (const header of expected) {
      expect(FORBIDDEN_RESPONSE_HEADERS.has(header)).toBe(true)
    }
    expect(FORBIDDEN_RESPONSE_HEADERS.size).toBe(expected.length)
  })
})

describe('isAllowedResponseHeader', () => {
  it('allows safe headers', () => {
    expect(isAllowedResponseHeader('Content-Type')).toBe(true)
    expect(isAllowedResponseHeader('X-Custom-Header')).toBe(true)
    expect(isAllowedResponseHeader('X-Request-Id')).toBe(true)
    expect(isAllowedResponseHeader('Cache-Control')).toBe(true)
  })

  it('rejects forbidden headers (case-insensitive)', () => {
    expect(isAllowedResponseHeader('Set-Cookie')).toBe(false)
    expect(isAllowedResponseHeader('set-cookie')).toBe(false)
    expect(isAllowedResponseHeader('SET-COOKIE')).toBe(false)
    expect(isAllowedResponseHeader('Location')).toBe(false)
    expect(isAllowedResponseHeader('LOCATION')).toBe(false)
  })

  it('rejects all CORS headers', () => {
    expect(isAllowedResponseHeader('Access-Control-Allow-Origin')).toBe(false)
    expect(isAllowedResponseHeader('Access-Control-Allow-Credentials')).toBe(false)
    expect(isAllowedResponseHeader('Access-Control-Allow-Headers')).toBe(false)
    expect(isAllowedResponseHeader('Access-Control-Allow-Methods')).toBe(false)
  })

  it('rejects security-sensitive headers', () => {
    expect(isAllowedResponseHeader('Content-Security-Policy')).toBe(false)
    expect(isAllowedResponseHeader('Strict-Transport-Security')).toBe(false)
    expect(isAllowedResponseHeader('X-Frame-Options')).toBe(false)
    expect(isAllowedResponseHeader('WWW-Authenticate')).toBe(false)
    expect(isAllowedResponseHeader('Proxy-Authenticate')).toBe(false)
  })

  it('rejects transport-level headers', () => {
    expect(isAllowedResponseHeader('Transfer-Encoding')).toBe(false)
    expect(isAllowedResponseHeader('Connection')).toBe(false)
    expect(isAllowedResponseHeader('Upgrade')).toBe(false)
  })
})
