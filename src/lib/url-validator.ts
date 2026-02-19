import dns from 'dns'

/**
 * SSRF protection: validates that a target URL does not resolve to
 * internal/private network addresses before allowing server-side requests.
 */

export interface ValidationResult {
  safe: boolean
  reason?: string
  resolvedIp?: string
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
const BLOCKED_IPV4_CIDRS = [
  '10.0.0.0/8', // RFC 1918 private
  '172.16.0.0/12', // RFC 1918 private
  '192.168.0.0/16', // RFC 1918 private
  '127.0.0.0/8', // Loopback
  '169.254.0.0/16', // Link-local / cloud metadata (AWS, GCP)
  '0.0.0.0/8', // "This" network
  '100.64.0.0/10', // Carrier-grade NAT (RFC 6598)
  '224.0.0.0/4', // Multicast
  '240.0.0.0/4', // Reserved / Class E
]

/**
 * Blocked IPv6 CIDR ranges.
 */
const BLOCKED_IPV6_CIDRS = [
  '::1/128', // Loopback
  'fc00::/7', // Unique Local Addresses (ULA)
  'fe80::/10', // Link-local
  '::ffff:0:0/96', // IPv4-mapped IPv6 addresses
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
  return BLOCKED_IPV4_CIDRS.some((range) => isInRange(ip, range))
}

/**
 * Expand a potentially compressed IPv6 address to its full 8-group form.
 * Returns an array of 8 16-bit group values.
 */
function expandIPv6(ip: string): number[] {
  // Handle IPv4-mapped form like ::ffff:192.168.1.1
  const ipv4MappedMatch = ip.match(/^(.*):(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)
  if (ipv4MappedMatch) {
    const ipv4Parts = ipv4MappedMatch[2].split('.').map(Number)
    const highWord = (ipv4Parts[0] << 8) | ipv4Parts[1]
    const lowWord = (ipv4Parts[2] << 8) | ipv4Parts[3]
    // Replace the IPv4 portion with two hex groups
    ip = `${ipv4MappedMatch[1]}:${highWord.toString(16)}:${lowWord.toString(16)}`
  }

  const parts = ip.split('::')
  let groups: string[]

  if (parts.length === 2) {
    const left = parts[0] ? parts[0].split(':') : []
    const right = parts[1] ? parts[1].split(':') : []
    const missing = 8 - left.length - right.length
    const middle = Array(missing).fill('0')
    groups = [...left, ...middle, ...right]
  } else {
    groups = ip.split(':')
  }

  return groups.map((g) => parseInt(g, 16) || 0)
}

/**
 * Convert an IPv6 address string to a BigInt for 128-bit arithmetic.
 */
export function ipv6ToBigInt(ip: string): bigint {
  const groups = expandIPv6(ip)
  let result = 0n
  for (const group of groups) {
    result = (result << 16n) | BigInt(group)
  }
  return result
}

/**
 * Check whether an IPv6 address falls within a CIDR range using BigInt arithmetic.
 */
export function isInRangeIPv6(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/')
  const bits = parseInt(bitsStr, 10)
  const mask = bits === 0 ? 0n : ((1n << 128n) - 1n) << BigInt(128 - bits)
  return (ipv6ToBigInt(ip) & mask) === (ipv6ToBigInt(range) & mask)
}

/**
 * Check whether an IPv6 address is blocked (loopback, ULA, link-local, IPv4-mapped).
 */
function isBlockedIPv6(ip: string): boolean {
  return BLOCKED_IPV6_CIDRS.some((cidr) => isInRangeIPv6(ip, cidr))
}

/**
 * Validate that a target URL is safe to make a server-side request to.
 *
 * Checks performed:
 * 1. URL is parseable and uses http: or https: scheme
 * 2. URL does not contain embedded credentials
 * 3. Hostname is not a known-blocked name (localhost, [::1])
 * 4. DNS resolution succeeds (all addresses checked)
 * 5. All resolved IPs are not in any private/reserved range
 *
 * Returns the first safe resolved IP address to prevent DNS rebinding TOCTOU attacks.
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
    return {
      safe: false,
      reason: `Scheme "${parsed.protocol.replace(':', '')}" is not allowed. Use http or https.`,
    }
  }

  // 2. Check for embedded credentials
  if (parsed.username || parsed.password) {
    return { safe: false, reason: 'URLs with embedded credentials are not allowed' }
  }

  // 3. Check hostname against blocked names
  const hostname = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    return { safe: false, reason: `Hostname "${hostname}" is not allowed` }
  }

  // 4. DNS resolve the hostname — check ALL addresses
  let addresses: dns.LookupAddress[]
  try {
    addresses = await dns.promises.lookup(hostname, { all: true })
  } catch (error) {
    const code =
      error instanceof Error && 'code' in error
        ? (error as NodeJS.ErrnoException).code
        : 'unknown'
    return { safe: false, reason: `Could not resolve hostname (${code})` }
  }

  if (addresses.length === 0) {
    return { safe: false, reason: 'Could not resolve hostname (no addresses)' }
  }

  // 5. Check ALL resolved IPs — if any is blocked, reject
  for (const { address, family } of addresses) {
    if (family === 6) {
      if (isBlockedIPv6(address)) {
        return { safe: false, reason: 'Target resolves to a blocked IPv6 address' }
      }
    } else {
      if (isBlockedIPv4(address)) {
        return { safe: false, reason: 'Target resolves to a private or reserved IP address' }
      }
    }
  }

  // Return the first resolved address to pin the connection and prevent DNS rebinding
  return { safe: true, resolvedIp: addresses[0].address }
}
