import { describe, it, expect, vi, beforeEach } from 'vitest'
import dns from 'dns'
import { validateTargetUrl } from '../url-validator'

// Mock dns.promises.lookup
vi.mock('dns', () => ({
  default: {
    promises: {
      lookup: vi.fn(),
    },
  },
}))

const mockLookup = vi.mocked(dns.promises.lookup)

describe('validateTargetUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('valid public URLs', () => {
    it('allows https://example.com', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 })
      const result = await validateTargetUrl('https://example.com')
      expect(result.safe).toBe(true)
    })

    it('allows https://api.stripe.com/webhooks', async () => {
      mockLookup.mockResolvedValue({ address: '35.190.80.1', family: 4 })
      const result = await validateTargetUrl('https://api.stripe.com/webhooks')
      expect(result.safe).toBe(true)
    })

    it('allows http:// scheme', async () => {
      mockLookup.mockResolvedValue({ address: '93.184.216.34', family: 4 })
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
      mockLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 })
      const result = await validateTargetUrl('http://127.0.0.1')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks http://10.0.0.1', async () => {
      mockLookup.mockResolvedValue({ address: '10.0.0.1', family: 4 })
      const result = await validateTargetUrl('http://10.0.0.1')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks http://172.16.0.1', async () => {
      mockLookup.mockResolvedValue({ address: '172.16.0.1', family: 4 })
      const result = await validateTargetUrl('http://172.16.0.1')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks http://192.168.1.1', async () => {
      mockLookup.mockResolvedValue({ address: '192.168.1.1', family: 4 })
      const result = await validateTargetUrl('http://192.168.1.1')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks http://0.0.0.0', async () => {
      mockLookup.mockResolvedValue({ address: '0.0.0.0', family: 4 })
      const result = await validateTargetUrl('http://0.0.0.0')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })
  })

  describe('cloud metadata endpoint', () => {
    it('blocks http://169.254.169.254 (AWS/GCP metadata)', async () => {
      mockLookup.mockResolvedValue({ address: '169.254.169.254', family: 4 })
      const result = await validateTargetUrl('http://169.254.169.254')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks http://169.254.169.254/latest/meta-data/', async () => {
      mockLookup.mockResolvedValue({ address: '169.254.169.254', family: 4 })
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
    it('handles DNS resolution failure gracefully', async () => {
      mockLookup.mockRejectedValue(new Error('ENOTFOUND'))
      const result = await validateTargetUrl('https://nonexistent.invalid')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('Could not resolve hostname')
    })
  })

  describe('hostnames that resolve to private IPs', () => {
    it('blocks a hostname that resolves to 127.0.0.1', async () => {
      mockLookup.mockResolvedValue({ address: '127.0.0.1', family: 4 })
      const result = await validateTargetUrl('https://evil-redirect.example.com/hook')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks a hostname that resolves to 10.x.x.x', async () => {
      mockLookup.mockResolvedValue({ address: '10.255.255.1', family: 4 })
      const result = await validateTargetUrl('https://internal.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('private or reserved')
    })

    it('blocks a hostname that resolves to 192.168.x.x', async () => {
      mockLookup.mockResolvedValue({ address: '192.168.0.100', family: 4 })
      const result = await validateTargetUrl('https://sneaky.example.com')
      expect(result.safe).toBe(false)
    })
  })

  describe('IPv6', () => {
    it('blocks IPv6 loopback ::1', async () => {
      mockLookup.mockResolvedValue({ address: '::1', family: 6 })
      const result = await validateTargetUrl('https://ipv6-loopback.example.com')
      expect(result.safe).toBe(false)
      expect(result.reason).toContain('blocked IPv6')
    })

    it('allows public IPv6 addresses', async () => {
      mockLookup.mockResolvedValue({ address: '2606:4700:4700::1111', family: 6 })
      const result = await validateTargetUrl('https://ipv6-public.example.com')
      expect(result.safe).toBe(true)
    })
  })

  describe('edge cases in private ranges', () => {
    it('blocks 172.16.0.0 (start of range)', async () => {
      mockLookup.mockResolvedValue({ address: '172.16.0.0', family: 4 })
      const result = await validateTargetUrl('https://example.com')
      expect(result.safe).toBe(false)
    })

    it('blocks 172.31.255.255 (end of range)', async () => {
      mockLookup.mockResolvedValue({ address: '172.31.255.255', family: 4 })
      const result = await validateTargetUrl('https://example.com')
      expect(result.safe).toBe(false)
    })

    it('allows 172.32.0.0 (just outside range)', async () => {
      mockLookup.mockResolvedValue({ address: '172.32.0.0', family: 4 })
      const result = await validateTargetUrl('https://example.com')
      expect(result.safe).toBe(true)
    })

    it('allows 172.15.255.255 (just below range)', async () => {
      mockLookup.mockResolvedValue({ address: '172.15.255.255', family: 4 })
      const result = await validateTargetUrl('https://example.com')
      expect(result.safe).toBe(true)
    })
  })
})
