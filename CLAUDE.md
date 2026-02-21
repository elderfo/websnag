# Websnag — AI-Powered Webhook Debugger

## Project Overview

Websnag is a micro-SaaS webhook testing and debugging tool. Users create private webhook endpoints, receive and inspect incoming HTTP requests in real-time, and get AI-powered payload analysis that auto-detects webhook types, explains payloads in plain English, and generates handler code snippets.

**Tagline:** "See what your webhooks are really saying."

**Target users:** Solo developers and small teams building webhook integrations with services like Stripe, GitHub, Shopify, etc.

**Business model:**

- Free: 2 endpoints, 100 requests/mo, 24hr history, 5 AI analyses/mo
- Pro ($7/mo): Unlimited endpoints, unlimited requests, 30-day history, unlimited AI analysis, replay, custom endpoint slugs

## Tech Stack

| Layer           | Technology                           | Purpose                                   |
| --------------- | ------------------------------------ | ----------------------------------------- |
| Framework       | Next.js 14+ (App Router, TypeScript) | Full-stack application                    |
| Styling         | Tailwind CSS                         | Utility-first CSS                         |
| Database        | Supabase (PostgreSQL)                | Data storage, auth, realtime              |
| Auth            | Supabase Auth                        | GitHub OAuth + magic link email           |
| Realtime        | Supabase Realtime                    | WebSocket push for new requests           |
| AI              | Anthropic Claude API (Sonnet)        | Payload analysis and code generation      |
| Payments        | Stripe                               | Checkout, Customer Portal, usage metering |
| Hosting         | Vercel                               | Deployment, serverless functions, edge    |
| Package manager | pnpm                                 | Preferred over npm/yarn                   |

## Project Structure

```
websnag/
├── CLAUDE.md                    # This file
├── .env.local                   # Local environment variables (never commit)
├── .env.example                 # Template for env vars
├── .github/
│   └── workflows/
│       └── ci.yml               # CI pipeline: lint, typecheck, test, build + bundle secret scan
├── scripts/
│   └── check-bundle-secrets.sh  # Scans .next/static/ for leaked secret key prefixes
├── supabase/
│   └── migrations/              # SQL migration files (numbered)
│       ├── 001_initial_schema.sql
│       ├── 002_rls_policies.sql
│       ├── 003_usage_functions.sql
│       ├── 004_profiles_and_usernames.sql
│       ├── 005_data_retention.sql   # Retention cleanup function + pg_cron schedule
│       ├── 006_retention_alerting.sql  # RPC function to query pg_cron job run history
│       ├── 007_cancel_at_period_end.sql  # Boolean column for pending cancellation tracking
│       ├── 008_audit_log.sql          # Audit log table + RLS for user-facing activity log
│       └── 009_analytics_functions.sql  # Server-side SQL aggregation RPCs for analytics
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout with providers
│   │   ├── page.tsx             # Landing/marketing page
│   │   ├── auth/
│   │   │   ├── login/page.tsx
│   │   │   ├── callback/route.ts  # OAuth callback handler
│   │   │   └── redirect/page.tsx  # Client-side post-auth redirect (handles upgrade intent)
│   │   ├── privacy/
│   │   │   └── page.tsx         # Privacy policy (server component, public)
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx       # Dashboard shell (sidebar + header)
│   │   │   ├── dashboard/page.tsx  # Endpoint list / overview
│   │   │   ├── endpoints/
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx    # Endpoint detail + request feed
│   │   │   │       └── settings/page.tsx
│   │   │   ├── analytics/page.tsx   # Analytics dashboard with usage charts (client component)
│   │   │   ├── settings/page.tsx   # Account settings
│   │   │   └── billing/page.tsx    # Stripe Customer Portal redirect
│   │   └── api/
│   │       ├── wh/[slug]/route.ts     # Webhook capture endpoint (THE critical path)
│   │       ├── analytics/route.ts      # Analytics aggregation endpoint (volume, methods, top endpoints)
│   │       ├── analyze/route.ts       # AI analysis endpoint
│   │       ├── replay/route.ts        # Replay webhook to target URL
│   │       ├── health/
│   │       │   ├── route.ts          # Health check endpoint (DB connectivity)
│   │       │   └── retention/
│   │       │       └── route.ts      # Retention job health check + Resend alerting
│   │       ├── requests/
│   │       │   ├── [id]/route.ts        # Single request delete
│   │       │   ├── bulk-delete/route.ts  # Bulk request delete
│   │       │   └── export/route.ts       # Request export (JSON download)
│   │       ├── admin/
│   │       │   └── retention/route.ts # Manual retention cleanup trigger
│   │       └── stripe/
│   │           ├── checkout/route.ts  # Create Stripe Checkout session
│   │           └── webhook/route.ts   # Stripe webhook handler
│   ├── components/
│   │   ├── ui/                  # Reusable UI primitives (button, input, card, badge, etc.)
│   │   │   ├── confirm-dialog.tsx   # Generic confirmation modal
│   │   │   ├── wordmark.tsx         # Two-tone "websnag" brand wordmark (web=gray, snag=green)
│   │   ├── layout/              # Header, Sidebar, Nav
│   │   ├── endpoints/           # Endpoint-specific components
│   │   │   ├── code-snippets.tsx    # Multi-language webhook request examples (collapsible)
│   │   ├── requests/            # Request feed, detail view, filters
│   │   │   ├── filter-bar.tsx       # Method, date, search filters
│   │   │   ├── bulk-actions.tsx     # Bulk select, delete, export bar
│   │   ├── analysis/            # AI analysis display, code snippets
│   │   ├── analytics/           # Analytics charts (SVG-based, no chart library)
│   │   │   ├── volume-chart.tsx     # Bar chart for request volume over time
│   │   │   ├── method-chart.tsx     # Horizontal bars for HTTP method breakdown
│   │   │   └── top-endpoints.tsx    # Ranked list with proportional bars
│   │   ├── settings/            # Settings-specific components
│   │   │   └── audit-log.tsx        # Activity log table (client component)
│   │   ├── onboarding/          # Onboarding experience components
│   │   │   └── checklist.tsx      # Dismissible onboarding checklist (localStorage-backed)
│   │   └── billing/             # Upgrade prompts, usage display
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        # Browser Supabase client
│   │   │   ├── server.ts        # Server-side Supabase client
│   │   │   ├── middleware.ts    # Auth middleware for protected routes
│   │   │   └── cron.ts          # Query pg_cron job run history via RPC
│   │   ├── stripe.ts            # Stripe client and helpers
│   │   ├── anthropic.ts         # Claude API client and prompts
│   │   ├── email.ts              # Welcome email utility (Resend API or placeholder logging)
│   │   ├── logger.ts             # Pino structured logger (createLogger, createRequestLogger)
│   │   ├── audit.ts              # Fire-and-forget audit log writer (admin client)
│   │   ├── retention-health.ts   # Pure retention job health evaluation logic
│   │   ├── usage.ts             # Usage tracking and limit checking
│   │   └── utils.ts             # Shared utilities
│   ├── hooks/
│   │   ├── use-realtime-requests.ts  # Subscribe to new requests via Supabase Realtime
│   │   ├── use-endpoints.ts
│   │   └── use-usage.ts
│   └── types/
│       └── index.ts             # TypeScript types for all entities
├── public/
│   └── og-image.png             # Open Graph image for social sharing
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

## Environment Variables

```env
# .env.example — copy to .env.local and fill in values

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key  # Client-safe publishable key
SUPABASE_SECRET_KEY=sb_secret_your-key  # Server-side only, never expose

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRO_PRICE_ID=price_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Database Schema

Create these as numbered migration files in `supabase/migrations/`.

### 001_initial_schema.sql

```sql
-- Endpoints: webhook receivers
CREATE TABLE endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  response_code INT DEFAULT 200,
  response_body TEXT DEFAULT '{"ok": true}',
  response_headers JSONB DEFAULT '{"Content-Type": "application/json"}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Requests: captured webhook payloads
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID REFERENCES endpoints(id) ON DELETE CASCADE NOT NULL,
  method TEXT NOT NULL,
  headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  body TEXT,
  query_params JSONB DEFAULT '{}'::jsonb,
  content_type TEXT,
  source_ip TEXT,
  size_bytes INT DEFAULT 0,
  received_at TIMESTAMPTZ DEFAULT now(),
  -- AI analysis fields (populated async on demand)
  ai_analysis JSONB DEFAULT NULL
);

-- Usage tracking
CREATE TABLE usage (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,  -- format: 'YYYY-MM'
  request_count INT DEFAULT 0,
  ai_analysis_count INT DEFAULT 0,
  PRIMARY KEY (user_id, month)
);

-- Subscriptions: track Stripe subscription status
CREATE TABLE subscriptions (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_endpoints_user_id ON endpoints(user_id);
CREATE INDEX idx_endpoints_slug ON endpoints(slug);
CREATE INDEX idx_requests_endpoint_id ON requests(endpoint_id);
CREATE INDEX idx_requests_received_at ON requests(received_at DESC);
CREATE INDEX idx_usage_month ON usage(month);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER endpoints_updated_at
  BEFORE UPDATE ON endpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 002_rls_policies.sql

```sql
-- Enable RLS on all tables
ALTER TABLE endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Endpoints: users see only their own
CREATE POLICY "Users can view own endpoints"
  ON endpoints FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own endpoints"
  ON endpoints FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own endpoints"
  ON endpoints FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own endpoints"
  ON endpoints FOR DELETE USING (auth.uid() = user_id);

-- Requests: users see requests for their endpoints
CREATE POLICY "Users can view requests for own endpoints"
  ON requests FOR SELECT
  USING (endpoint_id IN (SELECT id FROM endpoints WHERE user_id = auth.uid()));

-- Requests INSERT uses secret key (from webhook capture API route), no RLS policy needed for insert.
-- Instead, grant insert to service_role and the webhook capture route uses the admin client with the secret key.

-- Usage: users see only their own
CREATE POLICY "Users can view own usage"
  ON usage FOR SELECT USING (auth.uid() = user_id);

-- Subscriptions: users see only their own
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);
```

### 003_usage_functions.sql

```sql
-- Increment request count for a user's current month
CREATE OR REPLACE FUNCTION increment_request_count(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO usage (user_id, month, request_count)
  VALUES (p_user_id, to_char(now(), 'YYYY-MM'), 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET request_count = usage.request_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment AI analysis count
CREATE OR REPLACE FUNCTION increment_ai_analysis_count(p_user_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO usage (user_id, month, ai_analysis_count)
  VALUES (p_user_id, to_char(now(), 'YYYY-MM'), 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET ai_analysis_count = usage.ai_analysis_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get current usage for a user
CREATE OR REPLACE FUNCTION get_current_usage(p_user_id UUID)
RETURNS TABLE (request_count INT, ai_analysis_count INT) AS $$
BEGIN
  RETURN QUERY
  SELECT COALESCE(u.request_count, 0), COALESCE(u.ai_analysis_count, 0)
  FROM usage u
  WHERE u.user_id = p_user_id AND u.month = to_char(now(), 'YYYY-MM');

  IF NOT FOUND THEN
    request_count := 0;
    ai_analysis_count := 0;
    RETURN NEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Supabase Realtime Setup

Enable Realtime on the `requests` table via the Supabase dashboard (Database → Replication → enable `requests` table). This is a manual step, not a migration.

The client subscribes like this:

```typescript
const channel = supabase
  .channel('endpoint-requests')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'requests',
      filter: `endpoint_id=eq.${endpointId}`,
    },
    (payload) => {
      // payload.new contains the new request row
      // Prepend to the request list in state
    }
  )
  .subscribe()
```

## Critical Path: Webhook Capture Route

`src/app/api/wh/[slug]/route.ts` is the most important file in the application. It must:

1. Accept ANY HTTP method (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS)
2. Look up the endpoint by slug
3. Check if the endpoint is active
4. Look up the endpoint's owner and check usage limits
5. Capture: method, headers, body (as raw text), query params, content-type, source IP, body size
6. Insert into `requests` table using the **admin** client with the secret key (bypasses RLS)
7. Increment the user's request count
8. Return the endpoint's configured response (status code, body, headers)
9. If the user is Pro and auto-analysis is enabled, trigger AI analysis async (don't block the response)

**Performance matters here.** This endpoint will be hit by external services (Stripe, GitHub, etc.) and must respond quickly. The database insert and usage increment should be fast. AI analysis should be fire-and-forget (or queued).

**Size limit:** Accept up to 1MB request bodies. Reject larger with 413 status.

```typescript
// Handler must support all methods
export async function GET(req, { params }) {
  return handleWebhook(req, params)
}
export async function POST(req, { params }) {
  return handleWebhook(req, params)
}
export async function PUT(req, { params }) {
  return handleWebhook(req, params)
}
export async function PATCH(req, { params }) {
  return handleWebhook(req, params)
}
export async function DELETE(req, { params }) {
  return handleWebhook(req, params)
}
```

## AI Analysis

When a user clicks "Analyze" on a request (or auto-triggered for Pro), call the Anthropic API server-side.

### Prompt Template

```typescript
const systemPrompt = `You are a webhook payload analyzer. Given an HTTP request (method, headers, body), identify what kind of webhook this is, explain it in plain English, and generate handler code.

Respond ONLY with valid JSON, no markdown fences, no preamble:
{
  "source": "Service name (e.g., Stripe, GitHub, Shopify) or 'Unknown'",
  "webhook_type": "Specific event type (e.g., payment_intent.succeeded, push, orders/create)",
  "summary": "1-2 sentence plain English explanation of what this webhook means and what action you'd typically take",
  "key_fields": [
    {"path": "json.path.to.field", "description": "what this field means"}
  ],
  "schema_notes": "Any missing, unusual, or notable fields compared to typical payloads from this source. Say 'Looks standard' if nothing unusual.",
  "handler_node": "// Complete Express.js route handler (10-20 lines)",
  "handler_python": "# Complete Flask route handler (10-20 lines)"
}`

const userMessage = `Analyze this webhook request:

Method: ${method}
Content-Type: ${contentType}

Headers:
${JSON.stringify(headers, null, 2)}

Body:
${body}`
```

### API Route: `/api/analyze`

- Accepts `{ requestId: string }`
- Fetches the request from the database
- Checks the user owns the endpoint that owns the request
- Checks AI analysis usage limits (free: 5/mo, pro: unlimited)
- Calls Claude API with the prompt above
- Parses response JSON and stores in `requests.ai_analysis`
- Increments `ai_analysis_count` in usage
- Returns the analysis to the client

Use `claude-sonnet-4-20250514` model. Set `max_tokens: 1500`.

## Stripe Integration

### Checkout Flow

1. User clicks "Upgrade to Pro" → hits `/api/stripe/checkout`
2. Server creates a Stripe Checkout Session with the Pro price ID
3. Redirect user to Stripe Checkout
4. On success, Stripe sends `checkout.session.completed` webhook → `/api/stripe/webhook`
5. Webhook handler creates/updates the `subscriptions` row

### Webhook Handler: `/api/stripe/webhook`

Handle these events:

- `checkout.session.completed` → Create subscription record, set plan to 'pro'
- `customer.subscription.updated` → Update status, plan, period end
- `customer.subscription.deleted` → Set plan to 'free', status to 'canceled'
- `invoice.payment_failed` → Set status to 'past_due'

**Important:** Verify the Stripe webhook signature using `STRIPE_WEBHOOK_SECRET`.

### Helper: Check if user is Pro

```typescript
async function isProUser(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('plan, status')
    .eq('user_id', userId)
    .single()
  return data?.plan === 'pro' && data?.status === 'active'
}
```

## Tier Limits

```typescript
const LIMITS = {
  free: {
    maxEndpoints: 2,
    maxRequestsPerMonth: 100,
    maxAiAnalysesPerMonth: 5,
    historyRetentionHours: 24,
    customSlugs: false,
  },
  pro: {
    maxEndpoints: Infinity,
    maxRequestsPerMonth: Infinity,
    maxAiAnalysesPerMonth: Infinity,
    historyRetentionDays: 30,
    customSlugs: true,
  },
} as const
```

## Slug Generation

- **Free users:** Auto-generated random slug. Use `nanoid` with a custom alphabet (lowercase + digits, no ambiguous chars). Length: 12 characters. Example: `websnag.dev/wh/a7k3m9x2p4nq`
- **Pro users:** Can choose a custom slug when creating an endpoint. Validate: 3-48 chars, lowercase alphanumeric + hyphens, no leading/trailing hyphens. Fall back to random if not specified.

```typescript
import { nanoid } from 'nanoid'
const generateSlug = () => nanoid(12)
```

## Replay Feature

`/api/replay` accepts `{ requestId: string, targetUrl: string }` and:

1. Fetches the original request from the database
2. Validates the user owns the endpoint
3. Validates user is Pro
4. Sends the original request (same method, headers, body) to the target URL
5. Captures the response (status, headers, body)
6. Returns the response to the client for side-by-side comparison

Use a reasonable timeout (10 seconds) and handle errors gracefully.

## UI/UX Guidelines

### Design Direction

- **Tone:** Developer-focused, clean, professional. Think "Linear meets Vercel dashboard."
- **Color scheme:** Dark mode by default. Near-black background (#0a0a0b), subtle borders (#1f1f23), accent color — electric green (#00ff88) or bright cyan for the "live" feel. Keep it restrained.
- **Typography:** Monospace for code/payloads (JetBrains Mono or Fira Code via Google Fonts). Sans-serif for UI text (Geist or similar).
- **Key interactions:**
  - Request feed should feel alive — new requests slide in from top with a subtle animation
  - JSON payloads should be syntax-highlighted and collapsible
  - Copy buttons everywhere (endpoint URL, request body, headers, cURL command, handler code)
  - Status method badges: GET=blue, POST=green, PUT=orange, DELETE=red, PATCH=purple

### Key Pages

**Dashboard (`/dashboard`):**

- List of endpoints as cards showing: name, URL (with copy button), request count today, status (active/paused)
- "New Endpoint" button
- Usage summary in sidebar or header (X/100 requests this month)

**Endpoint Detail (`/endpoints/[id]`):**

- Full endpoint URL prominently displayed with copy button
- Real-time request feed (newest first) — each row shows: method badge, truncated path, timestamp, size, analysis status
- Click a request to expand detail panel (or navigate to detail)

**Request Detail (panel or sub-page):**

- Tabs: Body | Headers | Query Params | Analysis
- Body tab: Syntax-highlighted JSON (or raw text for non-JSON), copy button, cURL command generator
- Headers tab: Key-value table
- Analysis tab: AI analysis results (or "Analyze" button if not yet analyzed)
  - Source badge (e.g., "Stripe"), event type, plain English summary
  - Key fields table
  - Handler code with language toggle (Node.js / Python) and copy button
- Replay button (Pro only) with target URL input and response display

**Landing Page (`/`):**

- Hero: Tagline, sub-copy, CTA to sign up
- Feature highlights (3-4 cards): Real-time capture, AI analysis, Replay, Developer-first
- Pricing section (Free vs Pro)
- Footer with links

## Code Conventions

- Use `async/await` throughout, no `.then()` chains
- Use Zod for request validation in API routes
- Use TypeScript strict mode
- Use server components by default, `'use client'` only when needed (interactivity, hooks)
- Prefer named exports over default exports (except for pages)
- Error handling: try/catch in API routes, return appropriate HTTP status codes with `{ error: string }` body
- Use `@/` path alias for imports from `src/`
- No `any` types — define proper interfaces

## Build Order

Follow this order. Each step should be fully working before moving to the next.

1. **Project init:** `pnpm create next-app`, add Tailwind, configure TypeScript, set up path aliases, install dependencies (`@supabase/supabase-js`, `@supabase/ssr`, `stripe`, `@anthropic-ai/sdk`, `nanoid`, `zod`)
2. **Supabase setup:** Create migration files, set up client/server Supabase helpers, auth middleware
3. **Auth flow:** Login page, GitHub OAuth, magic link, callback handler, protected route middleware
4. **Dashboard layout:** Sidebar, header, navigation shell (empty pages are fine)
5. **Endpoint CRUD:** Create, list, edit, delete endpoints. Slug generation. Settings page.
6. **Webhook capture route:** The critical `/api/wh/[slug]` handler. Test with cURL.
7. **Request feed:** List requests for an endpoint. Real-time updates via Supabase Realtime. Request detail view with tabs.
8. **AI analysis:** `/api/analyze` route, Claude API integration, analysis display component with code snippets
9. **Replay:** `/api/replay` route, UI for entering target URL and viewing response
10. **Stripe billing:** Checkout, webhook handler, subscription tracking, tier enforcement, upgrade prompts
11. **Landing page:** Marketing page with features and pricing
12. **Polish:** Loading states, empty states, error boundaries, mobile responsive, OG image, meta tags

## Testing the Webhook Capture

Once step 6 is done, test with:

```bash
# Basic POST
curl -X POST http://localhost:3000/api/wh/YOUR_SLUG \
  -H "Content-Type: application/json" \
  -d '{"event": "test", "data": {"id": 123}}'

# Simulate Stripe webhook
curl -X POST http://localhost:3000/api/wh/YOUR_SLUG \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=123,v1=abc" \
  -d '{"type": "payment_intent.succeeded", "data": {"object": {"id": "pi_123", "amount": 2000, "currency": "usd"}}}'

# GET request with query params
curl "http://localhost:3000/api/wh/YOUR_SLUG?callback=true&verify=abc123"

# Large headers
curl -X POST http://localhost:3000/api/wh/YOUR_SLUG \
  -H "X-Custom-Header: test-value" \
  -H "Authorization: Bearer fake-token" \
  -d "raw body content"
```

## Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "latest",
    "@supabase/ssr": "latest",
    "@supabase/supabase-js": "latest",
    "nanoid": "^5",
    "next": "14",
    "react": "^18",
    "react-dom": "^18",
    "stripe": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "autoprefixer": "latest",
    "postcss": "latest",
    "tailwindcss": "latest",
    "typescript": "latest"
  }
}
```

## Notes

- The webhook capture route (`/api/wh/[slug]`) must use the Supabase admin client with the **secret key** because the incoming request has no auth context — it's from an external service, not a logged-in user.
- Supabase Realtime must be enabled on the `requests` table manually in the Supabase dashboard.
- For local development, use `stripe listen --forward-to localhost:3000/api/stripe/webhook` to test Stripe webhooks.
- Request body size limit: 1MB. Return 413 for larger payloads.
- Old requests (beyond retention period) should be cleaned up. For MVP, this can be a Supabase cron job or edge function on a schedule. Not critical for launch.
- The landing page should be a server component with no auth required. Dashboard routes require auth.
