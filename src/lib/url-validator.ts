import dns from 'dns'

/**
 * SSRF protection: validates that a target URL does not resolve to
 * internal/private network addresses before allowing server-side requests.
 */

interface ValidationResult {
  safe: boolean
  reason?: string
}

/**
 * Convert a dotted-decimal IPv4 address to a 32-bit unsigned integer.
 */
function ipToLong(ip: string): number {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

/**
 * Check whether an IPv4 address falls within a CIDR range.
 */
function isInRange(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/')
  const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1) >>> 0
  return (ipToLong(ip) & mask) === (ipToLong(range) & mask)
}

/**
 * Private and reserved IPv4 CIDR ranges that must never be targeted.
 */
const BLOCKED_RANGES = [
  '10.0.0.0/8', // RFC 1918 private
  '172.16.0.0/12', // RFC 1918 private
  '192.168.0.0/16', // RFC 1918 private
  '127.0.0.0/8', // Loopback
  '169.254.0.0/16', // Link-local / cloud metadata (AWS, GCP)
  '0.0.0.0/8', // "This" network
]

/**
 * Hostnames that are always blocked regardless of DNS resolution.
 */
const BLOCKED_HOSTNAMES = new Set(['localhost', '[::1]'])

/**
 * Only these URL schemes are permitted for replay targets.
 */
const ALLOWED_SCHEMES = new Set(['http:', 'https:'])

/**
 * Check whether a resolved IPv4 address falls within any blocked range.
 */
function isBlockedIPv4(ip: string): boolean {
  return BLOCKED_RANGES.some((range) => isInRange(ip, range))
}

/**
 * Check whether an IPv6 address is a blocked loopback.
 */
function isBlockedIPv6(ip: string): boolean {
  return ip === '::1' || ip === '0:0:0:0:0:0:0:1'
}

/**
 * Validate that a target URL is safe to make a server-side request to.
 *
 * Checks performed:
 * 1. URL is parseable and uses http: or https: scheme
 * 2. Hostname is not a known-blocked name (localhost, [::1])
 * 3. DNS resolution succeeds
 * 4. Resolved IP is not in any private/reserved range
 */
export async function validateTargetUrl(url: string): Promise<ValidationResult> {
  // 1. Parse URL and check scheme
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { safe: false, reason: 'Invalid URL' }
  }

  if (!ALLOWED_SCHEMES.has(parsed.protocol)) {
    return { safe: false, reason: `Scheme "${parsed.protocol.replace(':', '')}" is not allowed. Use http or https.` }
  }

  // 2. Check hostname against blocked names
  const hostname = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: `Hostname "${hostname}" is not allowed` }
  }

  // 3. DNS resolve the hostname
  let address: string
  let family: number
  try {
    const result = await dns.promises.lookup(hostname)
    address = result.address
    family = result.family
  } catch {
    return { safe: false, reason: 'Could not resolve hostname' }
  }

  // 4. Check resolved IP
  if (family === 6) {
    if (isBlockedIPv6(address)) {
      return { safe: false, reason: 'Target resolves to a blocked IPv6 address' }
    }
  } else {
    if (isBlockedIPv4(address)) {
      return { safe: false, reason: 'Target resolves to a private or reserved IP address' }
    }
  }

  return { safe: true }
}
