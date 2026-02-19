// Blocked usernames that cannot be registered
export const BLOCKED_USERNAMES = new Set([
  // Major cloud / infra
  'aws',
  'amazon',
  'google',
  'googlecloud',
  'azure',
  'microsoft',
  'cloudflare',
  'vercel',
  'netlify',
  'heroku',
  'digitalocean',
  // Payment processors
  'stripe',
  'paypal',
  'square',
  'braintree',
  'adyen',
  'paddle',
  // Developer platforms
  'github',
  'gitlab',
  'bitbucket',
  'jira',
  'atlassian',
  'linear',
  'notion',
  'figma',
  'sentry',
  'datadog',
  'pagerduty',
  // E-commerce
  'shopify',
  'woocommerce',
  'magento',
  'bigcommerce',
  // Communication
  'slack',
  'discord',
  'twilio',
  'sendgrid',
  'mailchimp',
  // Auth providers
  'auth0',
  'okta',
  'onelogin',
  // Generic spoofing terms
  'admin',
  'support',
  'security',
  'billing',
  'payments',
  'webhook',
  'webhooks',
  'api',
  'websnag',
  'system',
  'official',
  'root',
  'test',
  'null',
  'undefined',
  'www',
  'mail',
  'ftp',
])

export function isBlockedUsername(username: string): boolean {
  return BLOCKED_USERNAMES.has(username.toLowerCase())
}
