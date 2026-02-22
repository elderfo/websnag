import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatBytes, timeAgo, generateCurlCommand, isJsonString, formatJson } from '../format'

describe('formatBytes', () => {
  it('returns "0 B" for zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes correctly', () => {
    expect(formatBytes(500)).toBe('500 B')
  })

  it('formats kilobytes correctly', () => {
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats megabytes correctly', () => {
    expect(formatBytes(1048576)).toBe('1 MB')
    expect(formatBytes(2621440)).toBe('2.5 MB')
  })

  it('handles small values', () => {
    expect(formatBytes(1)).toBe('1 B')
  })
})

describe('timeAgo', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns seconds ago for recent timestamps', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T00:00:30Z').getTime())
    expect(timeAgo('2026-01-01T00:00:00Z')).toBe('30s ago')
  })

  it('returns minutes ago', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T00:05:00Z').getTime())
    expect(timeAgo('2026-01-01T00:00:00Z')).toBe('5m ago')
  })

  it('returns hours ago', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T03:00:00Z').getTime())
    expect(timeAgo('2026-01-01T00:00:00Z')).toBe('3h ago')
  })

  it('returns days ago', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-03T00:00:00Z').getTime())
    expect(timeAgo('2026-01-01T00:00:00Z')).toBe('2d ago')
  })

  it('returns "just now" for future timestamps', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-01-01T00:00:00Z').getTime())
    expect(timeAgo('2026-01-01T00:00:05Z')).toBe('just now')
  })
})

describe('generateCurlCommand', () => {
  it('generates a basic GET command', () => {
    const result = generateCurlCommand(
      {
        method: 'GET',
        headers: {},
        body: null,
        query_params: {},
      },
      'https://example.com/wh/test'
    )
    expect(result).toContain('curl -X GET')
    expect(result).toContain('"https://example.com/wh/test"')
  })

  it('includes relevant headers', () => {
    const result = generateCurlCommand(
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer token',
          host: 'example.com',
        },
        body: null,
        query_params: {},
      },
      'https://example.com/wh/test'
    )
    expect(result).toContain('content-type: application/json')
    expect(result).toContain('authorization: Bearer token')
    expect(result).not.toContain('host:')
  })

  it('includes body with escaped quotes', () => {
    const result = generateCurlCommand(
      {
        method: 'POST',
        headers: {},
        body: '{"key": "value"}',
        query_params: {},
      },
      'https://example.com/wh/test'
    )
    expect(result).toContain('-d \'{"key": "value"}\'')
  })

  it('includes query params in URL', () => {
    const result = generateCurlCommand(
      {
        method: 'GET',
        headers: {},
        body: null,
        query_params: { foo: 'bar', baz: '123' },
      },
      'https://example.com/wh/test'
    )
    expect(result).toContain('foo=bar')
    expect(result).toContain('baz=123')
  })

  it('escapes single quotes in body', () => {
    const result = generateCurlCommand(
      {
        method: 'POST',
        headers: {},
        body: "it's a test",
        query_params: {},
      },
      'https://example.com/wh/test'
    )
    expect(result).toContain("it'\\''s a test")
  })

  it('escapes double quotes in header values', () => {
    const result = generateCurlCommand(
      {
        method: 'POST',
        headers: { 'X-Custom': 'value with "quotes"' },
        body: null,
        query_params: {},
      },
      'https://example.com/wh/test'
    )
    expect(result).toContain('X-Custom: value with \\"quotes\\"')
    expect(result).not.toContain('value with "quotes"')
  })

  it('escapes dollar signs in header values', () => {
    const result = generateCurlCommand(
      {
        method: 'POST',
        headers: { 'X-Custom': 'price is $100' },
        body: null,
        query_params: {},
      },
      'https://example.com/wh/test'
    )
    expect(result).toContain('X-Custom: price is \\$100')
  })

  it('escapes backticks in header values', () => {
    const result = generateCurlCommand(
      {
        method: 'POST',
        headers: { 'X-Custom': 'run `cmd`' },
        body: null,
        query_params: {},
      },
      'https://example.com/wh/test'
    )
    expect(result).toContain('X-Custom: run \\`cmd\\`')
  })

  it('escapes backslashes in header values', () => {
    const result = generateCurlCommand(
      {
        method: 'POST',
        headers: { 'X-Custom': 'path\\to\\file' },
        body: null,
        query_params: {},
      },
      'https://example.com/wh/test'
    )
    expect(result).toContain('X-Custom: path\\\\to\\\\file')
  })

  it('escapes shell metacharacters in header keys', () => {
    const result = generateCurlCommand(
      {
        method: 'POST',
        headers: { 'X-$pecial': 'safe' },
        body: null,
        query_params: {},
      },
      'https://example.com/wh/test'
    )
    expect(result).toContain('X-\\$pecial: safe')
  })

  it('escapes exclamation marks in header values', () => {
    const result = generateCurlCommand(
      {
        method: 'POST',
        headers: { 'X-Custom': 'alert! danger!' },
        body: null,
        query_params: {},
      },
      'https://example.com/wh/test'
    )
    expect(result).toContain('X-Custom: alert\\! danger\\!')
  })
})

describe('isJsonString', () => {
  it('returns true for valid JSON', () => {
    expect(isJsonString('{"key": "value"}')).toBe(true)
    expect(isJsonString('[]')).toBe(true)
    expect(isJsonString('"string"')).toBe(true)
    expect(isJsonString('null')).toBe(true)
  })

  it('returns false for invalid JSON', () => {
    expect(isJsonString('not json')).toBe(false)
    expect(isJsonString('{invalid}')).toBe(false)
    expect(isJsonString('')).toBe(false)
  })
})

describe('formatJson', () => {
  it('pretty-prints valid JSON', () => {
    expect(formatJson('{"a":1,"b":2}')).toBe('{\n  "a": 1,\n  "b": 2\n}')
  })

  it('returns original string for invalid JSON', () => {
    expect(formatJson('not json')).toBe('not json')
  })
})
