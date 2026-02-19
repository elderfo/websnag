import { describe, it, expect, vi, beforeEach } from 'vitest'
import dns from 'dns'
import { validateTargetUrl, ipv6ToBigInt, isInRangeIPv6 } from '../url-validator'

// Mock dns.promises.lookup
vi.mock('dns', () => ({
  default: {
    promises: {
      lookup: vi.fn(),
    },
  },
}))

const mockLookup = vi.mocked(dns.promises.lookup)

/**
 * Helper: mock dns.promises.lookup to return an array (for { all: true }).
 */
function mockLookupAll(addresses: Array<{ address: string; family: number }>) {
  mockLookup.mockResolvedValue(addresses as never)
}

/**
 * Helper: mock a single IPv4 result.
 */
function mockLookupSingle(address: string, family: number = 4) {
  mockLookupAll([{ address, family }])
}

describe('validateTargetUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('valid public URLs', () => {
    it('allows https://example.com', async () => {
      mockLookupSingle('93.184.216.34')
      const result = await validateTargetUrl('https://example.com')
      expect(result.safe).toBe(true)
      expect(result.resolvedIp).toBe('93.184.216.34')
    })

    it('allows https://api.stripe.com/webhooks', async () => {
      mockLookupSingle('35.190.80.1')
      const result = await validateTargetUrl('https://api.stripe.com/webhooks')
      expect(result.safe).toBe(true)
      expect(result.resolvedIp).toBe('35.190.80.1')
    })

    it('allows http:// scheme', async () => {
      mockLookupSingle('93.184.216.34')
      const result = await validateTargetUrl('http://example.com/hook')
      expect(result.safe).toBe(true)
    })
  })

  describe('blocked hostnames', () => {
    it('blocks http://localhost', async () => {
      const result = await validateTargetUrl('http://localhost')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('localhost')
    })

    it('blocks http://localhost:3000/path', async () => {
      const result = await validateTargetUrl('http://localhost:3000/path')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('localhost')
    })

    it('blocks http://[::1]', async () => {
      const result = await validateTargetUrl('http://[::1]')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('[::1]')
    })
  })

  describe('blocked IP addresses via direct URL', () => {
    it('blocks http://127.0.0.1', async () => {
      mockLookupSingle('127.0.0.1')
      const result = await validateTargetUrl('http://127.0.0.1')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks http://10.0.0.1', async () => {
      mockLookupSingle('10.0.0.1')
      const result = await validateTargetUrl('http://10.0.0.1')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks http://172.16.0.1', async () => {
      mockLookupSingle('172.16.0.1')
      const result = await validateTargetUrl('http://172.16.0.1')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks http://192.168.1.1', async () => {
      mockLookupSingle('192.168.1.1')
      const result = await validateTargetUrl('http://192.168.1.1')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks http://0.0.0.0', async () => {
      mockLookupSingle('0.0.0.0')
      const result = await validateTargetUrl('http://0.0.0.0')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })
  })

  describe('cloud metadata endpoint', () => {
    it('blocks http://169.254.169.254 (AWS/GCP metadata)', async () => {
      mockLookupSingle('169.254.169.254')
      const result = await validateTargetUrl('http://169.254.169.254')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks http://169.254.169.254/latest/meta-data/', async () => {
      mockLookupSingle('169.254.169.254')
      const result = await validateTargetUrl('http://169.254.169.254/latest/meta-data/')
      expect(result.safe).toBe(false)
    })
  })

  describe('blocked schemes', () => {
    it('blocks ftp:// scheme', async () => {
      const result = await validateTargetUrl('ftp://example.com/file')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('ftp')
      expect(result.reason).toContain('not allowed')
    })

    it('blocks file:// scheme', async () => {
      const result = await validateTargetUrl('file:///etc/passwd')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('file')
      expect(result.reason).toContain('not allowed')
    })

    it('blocks gopher:// scheme', async () => {
      const result = await validateTargetUrl('gopher://evil.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('gopher')
      expect(result.reason).toContain('not allowed')
    })
  })

  describe('invalid URLs', () => {
    it('rejects completely invalid URLs', async () => {
      const result = await validateTargetUrl('not-a-url')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('Invalid URL')
    })

    it('rejects empty string', async () => {
      const result = await validateTargetUrl('')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('Invalid URL')
    })
  })

  describe('DNS resolution failures', () => {
    it('handles DNS resolution failure gracefully and includes error code', async () => {
      const error = new Error('ENOTFOUND') as NodeJS.ErrnoException
      error.code = 'ENOTFOUND'
      mockLookup.mockRejectedValue(error)
      const result = await validateTargetUrl('https://nonexistent.invalid')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('Could not resolve hostname')
      expect(result.reason).toContain('ENOTFOUND')
    })

    it('includes "unknown" code when error has no code property', async () => {
      mockLookup.mockRejectedValue(new Error('generic failure'))
      const result = await validateTargetUrl('https://broken.invalid')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('(unknown)')
    })
  })

  describe('hostnames that resolve to private IPs', () => {
    it('blocks a hostname that resolves to 127.0.0.1', async () => {
      mockLookupSingle('127.0.0.1')
      const result = await validateTargetUrl('https://evil-redirect.example.com/hook')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks a hostname that resolves to 10.x.x.x', async () => {
      mockLookupSingle('10.255.255.1')
      const result = await validateTargetUrl('https://internal.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks a hostname that resolves to 192.168.x.x', async () => {
      mockLookupSingle('192.168.0.100')
      const result = await validateTargetUrl('https://sneaky.example.com')
      expect(result.safe).toBe(false)
    })
  })

  describe('IPv6', () => {
    it('blocks IPv6 loopback ::1', async () => {
      mockLookupSingle('::1', 6)
      const result = await validateTargetUrl('https://ipv6-loopback.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('blocked IPv6')
    })

    it('allows public IPv6 addresses', async () => {
      mockLookupSingle('2606:4700:4700::1111', 6)
      const result = await validateTargetUrl('https://ipv6-public.example.com')
      expect(result.safe).toBe(true)
      expect(result.resolvedIp).toBe('2606:4700:4700::1111')
    })

    it('blocks IPv6 ULA address fd00::1', async () => {
      mockLookupSingle('fd00::1', 6)
      const result = await validateTargetUrl('https://ula.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('blocked IPv6')
    })

    it('blocks IPv6 ULA address fdff:ffff::1', async () => {
      mockLookupSingle('fdff:ffff::1', 6)
      const result = await validateTargetUrl('https://ula2.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('blocked IPv6')
    })

    it('blocks IPv6 link-local fe80::1', async () => {
      mockLookupSingle('fe80::1', 6)
      const result = await validateTargetUrl('https://link-local.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('blocked IPv6')
    })

    it('blocks IPv4-mapped IPv6 ::ffff:192.168.1.1', async () => {
      mockLookupSingle('::ffff:192.168.1.1', 6)
      const result = await validateTargetUrl('https://mapped.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('blocked IPv6')
    })

    it('blocks IPv4-mapped IPv6 ::ffff:127.0.0.1', async () => {
      mockLookupSingle('::ffff:127.0.0.1', 6)
      const result = await validateTargetUrl('https://mapped-loopback.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('blocked IPv6')
    })

    it('blocks IPv4-mapped IPv6 ::ffff:10.0.0.1', async () => {
      mockLookupSingle('::ffff:10.0.0.1', 6)
      const result = await validateTargetUrl('https://mapped-private.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('blocked IPv6')
    })
  })

  describe('CGNAT range (100.64.0.0/10)', () => {
    it('blocks 100.64.0.1 (CGNAT start)', async () => {
      mockLookupSingle('100.64.0.1')
      const result = await validateTargetUrl('https://cgnat.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks 100.127.255.254 (CGNAT end)', async () => {
      mockLookupSingle('100.127.255.254')
      const result = await validateTargetUrl('https://cgnat-end.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('allows 100.128.0.1 (just outside CGNAT)', async () => {
      mockLookupSingle('100.128.0.1')
      const result = await validateTargetUrl('https://not-cgnat.example.com')
      expect(result.safe).toBe(true)
    })
  })

  describe('multicast and class E ranges', () => {
    it('blocks 224.0.0.1 (multicast)', async () => {
      mockLookupSingle('224.0.0.1')
      const result = await validateTargetUrl('https://multicast.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks 239.255.255.255 (multicast end)', async () => {
      mockLookupSingle('239.255.255.255')
      const result = await validateTargetUrl('https://multicast-end.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks 240.0.0.1 (class E / reserved)', async () => {
      mockLookupSingle('240.0.0.1')
      const result = await validateTargetUrl('https://classE.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks 255.255.255.254 (class E end)', async () => {
      mockLookupSingle('255.255.255.254')
      const result = await validateTargetUrl('https://classE-end.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })
  })

  describe('embedded credentials', () => {
    it('blocks URLs with username and password', async () => {
      const result = await validateTargetUrl('http://user:pass@example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('embedded credentials')
    })

    it('blocks URLs with username only', async () => {
      const result = await validateTargetUrl('http://admin@169.254.169.254/')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('embedded credentials')
    })

    it('blocks https URLs with credentials', async () => {
      const result = await validateTargetUrl('https://user:secret@internal.example.com/api')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('embedded credentials')
    })
  })

  describe('multiple DNS results (all addresses checked)', () => {
    it('blocks if any resolved address is private', async () => {
      mockLookupAll([
        { address: '93.184.216.34', family: 4 },
        { address: '192.168.1.1', family: 4 },
      ])
      const result = await validateTargetUrl('https://dual.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks if any resolved IPv6 address is private', async () => {
      mockLookupAll([
        { address: '93.184.216.34', family: 4 },
        { address: 'fd00::1', family: 6 },
      ])
      const result = await validateTargetUrl('https://dual-v6.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('blocked IPv6')
    })

    it('allows if all resolved addresses are public', async () => {
      mockLookupAll([
        { address: '93.184.216.34', family: 4 },
        { address: '93.184.216.35', family: 4 },
      ])
      const result = await validateTargetUrl('https://multi.example.com')
      expect(result.safe).toBe(true)
    })
  })

  describe('edge cases in private ranges', () => {
    it('blocks 172.16.0.0 (start of range)', async () => {
      mockLookupSingle('172.16.0.0')
      const result = await validateTargetUrl('https://example.com')
      expect(result.safe).toBe(false)
    })

    it('blocks 172.31.255.255 (end of range)', async () => {
      mockLookupSingle('172.31.255.255')
      const result = await validateTargetUrl('https://example.com')
      expect(result.safe).toBe(false)
    })

    it('allows 172.32.0.0 (just outside range)', async () => {
      mockLookupSingle('172.32.0.0')
      const result = await validateTargetUrl('https://example.com')
      expect(result.safe).toBe(true)
    })

    it('allows 172.15.255.255 (just below range)', async () => {
      mockLookupSingle('172.15.255.255')
      const result = await validateTargetUrl('https://example.com')
      expect(result.safe).toBe(true)
    })
  })

  describe('resolvedIp return value', () => {
    it('returns resolvedIp for safe URLs', async () => {
      mockLookupSingle('93.184.216.34')
      const result = await validateTargetUrl('https://example.com')
      expect(result.safe).toBe(true)
      expect(result.resolvedIp).toBe('93.184.216.34')
    })

    it('does not return resolvedIp for unsafe URLs', async () => {
      mockLookupSingle('127.0.0.1')
      const result = await validateTargetUrl('https://evil.example.com')
      expect(result.safe).toBe(false)
      expect(result.resolvedIp).toBeUndefined()
    })
  })
})

describe('ipv6ToBigInt', () => {
  it('converts ::1 correctly', () => {
    expect(ipv6ToBigInt('::1')).toBe(1n)
  })

  it('converts full address', () => {
    expect(ipv6ToBigInt('2001:0db8:0000:0000:0000:0000:0000:0001')).toBe(
      0x20010db8000000000000000000000001n
    )
  })

  it('converts compressed address', () => {
    expect(ipv6ToBigInt('2001:db8::1')).toBe(0x20010db8000000000000000000000001n)
  })

  it('converts fe80::1 correctly', () => {
    expect(ipv6ToBigInt('fe80::1')).toBe(0xfe800000000000000000000000000001n)
  })

  it('converts fd00::1 correctly', () => {
    expect(ipv6ToBigInt('fd00::1')).toBe(0xfd000000000000000000000000000001n)
  })
})

describe('isInRangeIPv6', () => {
  it('::1 is in ::1/128', () => {
    expect(isInRangeIPv6('::1', '::1/128')).toBe(true)
  })

  it('::2 is not in ::1/128', () => {
    expect(isInRangeIPv6('::2', '::1/128')).toBe(false)
  })

  it('fd00::1 is in fc00::/7 (ULA)', () => {
    expect(isInRangeIPv6('fd00::1', 'fc00::/7')).toBe(true)
  })

  it('fe80::1 is in fe80::/10 (link-local)', () => {
    expect(isInRangeIPv6('fe80::1', 'fe80::/10')).toBe(true)
  })

  it('2001:db8::1 is not in fe80::/10', () => {
    expect(isInRangeIPv6('2001:db8::1', 'fe80::/10')).toBe(false)
  })

  it('::ffff:c0a8:101 is in ::ffff:0:0/96 (IPv4-mapped)', () => {
    // ::ffff:c0a8:101 = ::ffff:192.168.1.1
    expect(isInRangeIPv6('::ffff:c0a8:101', '::ffff:0:0/96')).toBe(true)
  })
})
