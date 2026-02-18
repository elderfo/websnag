# Websnag — AI-Powered Webhook Debugger

## Build Plan (2 Weeks)

**Working name:** Websnag (alternatives: HookLens, WebhookPilot, HookScope)
**Tagline:** "See what your webhooks are really saying."
**Target:** Solo developers and small teams building webhook integrations
**Price:** Free tier (100 requests/mo) → Pro $7/mo (unlimited + AI analysis + replay)

---

## The Wedge

Every existing tool is either too basic (Webhook.site — public URLs, 48hr history, no analysis) or too enterprise (Hookdeck, Svix — production infrastructure, $$). Nobody is doing AI-powered payload understanding. That's the hook.

**Core value props:**

1. Private, persistent webhook endpoints with real-time streaming
2. AI that auto-identifies webhook types, explains payloads in plain English, and generates handler code
3. Replay/forward webhooks to your local dev server or production URL
4. Clean, fast UI that developers actually enjoy using

---

## Tech Stack

| Layer     | Choice                  | Why                                                                |
| --------- | ----------------------- | ------------------------------------------------------------------ |
| Framework | Next.js 14 (App Router) | Full-stack, fast to ship, great DX                                 |
| Database  | Supabase (PostgreSQL)   | Auth, DB, Realtime subscriptions, Row Level Security               |
| Hosting   | Vercel                  | Zero-config deploy, edge functions, generous free tier             |
| AI        | Claude API (Sonnet)     | Payload analysis — cheap per call, excellent at JSON understanding |
| Payments  | Stripe                  | Checkout + Customer Portal, webhook-based (dogfooding!)            |
| Realtime  | Supabase Realtime       | WebSocket subscriptions on new request inserts                     |
| Domain    | websnag.dev or similar  | ~$12/yr                                                            |

**Estimated monthly costs at launch:** ~$25-50 (Supabase free tier, Vercel free tier, Claude API usage minimal until traction)

---

## Data Model

```sql
-- Users (managed by Supabase Auth)

-- Endpoints: each user can create multiple webhook endpoints
CREATE TABLE endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- the unique URL path: websnag.dev/wh/{slug}
  description TEXT,
  response_code INT DEFAULT 200,
  response_body TEXT DEFAULT '{"ok": true}',
  response_headers JSONB DEFAULT '{"Content-Type": "application/json"}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Requests: captured webhook payloads
CREATE TABLE requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID REFERENCES endpoints(id) ON DELETE CASCADE,
  method TEXT NOT NULL,
  headers JSONB NOT NULL,
  body TEXT, -- raw body
  query_params JSONB,
  content_type TEXT,
  source_ip TEXT,
  received_at TIMESTAMPTZ DEFAULT now(),
  -- AI analysis (populated async)
  ai_analysis JSONB -- { type, summary, schema_notes, handler_code }
);

-- Usage tracking for free tier limits
CREATE TABLE usage (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- '2026-02'
  request_count INT DEFAULT 0,
  ai_analysis_count INT DEFAULT 0,
  PRIMARY KEY (user_id, month)
);
```

---

## Feature Scope — MVP Only

### Must Have (Week 1)

- [ ] Landing page with clear value prop and sign-up CTA
- [ ] Auth (Google OAuth + magic link via Supabase)
- [ ] Create/manage webhook endpoints (CRUD)
- [ ] Unique URLs: `websnag.dev/wh/{slug}`
- [ ] Capture incoming requests (method, headers, body, query params, IP)
- [ ] Real-time request feed (WebSocket — new requests appear instantly)
- [ ] Request detail view (formatted JSON, raw headers, metadata)
- [ ] Configurable response (status code, body, headers per endpoint)
- [ ] Basic search/filter on request history

### Must Have (Week 2)

- [ ] AI payload analysis (auto-detect webhook type, plain English summary, schema notes)
- [ ] AI-generated handler code snippet (Node.js/Python) for the payload
- [ ] Replay: resend a captured request to a target URL
- [ ] Stripe integration (free tier: 100 req/mo, Pro: $7/mo unlimited)
- [ ] Usage metering and limit enforcement
- [ ] Polish: loading states, error handling, empty states, mobile responsive
- [ ] Deploy to production

### Explicitly NOT in MVP

- Team/org features
- Custom domains
- Webhook forwarding/tunneling to localhost (future feature)
- Webhook signature verification
- API access
- Multiple response rules/conditional responses
- Export/download
- Slack/Discord notifications

---

## AI Analysis Feature (The Differentiator)

When a request comes in, the user can click "Analyze" (or it auto-runs for Pro users). This calls Claude Sonnet with a prompt like:

```
Analyze this incoming webhook request.

Method: POST
Headers: {headers}
Body: {body}

Respond with JSON:
{
  "webhook_type": "e.g. Stripe payment_intent.succeeded",
  "source": "e.g. Stripe, GitHub, Shopify, Unknown",
  "summary": "Plain English explanation of what this webhook means",
  "key_fields": ["list of important fields and what they mean"],
  "schema_notes": "Any missing or unusual fields compared to typical payloads",
  "handler_snippet_node": "// Node.js Express handler code",
  "handler_snippet_python": "# Python Flask handler code"
}
```

**Cost estimate:** ~$0.003-0.01 per analysis with Sonnet. Even at 1000 analyses/mo, that's $3-10. Margin is excellent at $7/mo.

---

## Day-by-Day Build Plan

### Week 1: Core Infrastructure

**Day 1 — Project Setup & Auth**

- Initialize Next.js project with TypeScript, Tailwind
- Set up Supabase project (database, auth)
- Implement auth flow (Google OAuth + magic link)
- Basic layout: nav, sidebar, main content area
- Deploy skeleton to Vercel

**Day 2 — Endpoint Management**

- Endpoints CRUD UI (create, list, edit, delete)
- Generate unique slugs
- Endpoint detail page with settings (response code, body, headers)
- Row Level Security policies in Supabase

**Day 3 — Webhook Capture**

- API route: `POST /wh/{slug}` — captures any incoming request
- Store method, headers, body, query params, IP, timestamp
- Return configurable response
- Handle edge cases (large payloads, binary data, missing content-type)

**Day 4 — Request Feed & Detail View**

- Request list view with real-time updates (Supabase Realtime)
- Request detail panel: formatted JSON body, headers table, metadata
- Copy-to-clipboard for body, individual headers, full cURL command
- Basic filtering (method, time range, text search in body)

**Day 5 — Polish & Testing**

- Test with real webhook providers (Stripe CLI, GitHub webhooks)
- Empty states, loading skeletons, error boundaries
- Mobile responsive pass
- Fix any real-world edge cases discovered in testing

### Week 2: AI + Payments + Launch

**Day 6 — AI Analysis**

- Claude API integration (server-side, never expose key)
- "Analyze" button on each request
- Display analysis results: type badge, summary, key fields, schema notes
- Cache analysis results in `ai_analysis` column

**Day 7 — Code Generation & Replay**

- Handler code snippets (Node/Express, Python/Flask) from AI analysis
- Syntax-highlighted code display with copy button
- Replay feature: resend captured request to user-specified URL
- Show replay response alongside original

**Day 8 — Stripe Billing**

- Stripe Checkout integration for Pro upgrade
- Customer Portal for subscription management
- Usage metering: count requests per month per user
- Free tier gate (100 requests/mo) with upgrade prompt
- Webhook handler for Stripe events (dogfooding!)

**Day 9 — Landing Page & SEO**

- Marketing landing page (hero, features, pricing, CTA)
- OG images, meta tags, structured data
- Documentation/getting started guide
- Blog post: "Why we built Websnag" (launch content)

**Day 10 — Launch Prep**

- End-to-end testing of full user journey
- Security review (RLS policies, API route protection, rate limiting)
- Error monitoring setup (Sentry free tier)
- Prepare Product Hunt launch
- Prepare posts for: r/webdev, r/SaaS, r/microsaas, Hacker News, X/Twitter

---

## Monetization Path

| Tier          | Price  | Limits                                                                        |
| ------------- | ------ | ----------------------------------------------------------------------------- |
| Free          | $0     | 2 endpoints, 100 requests/mo, 24hr history, 5 AI analyses/mo                  |
| Pro           | $7/mo  | Unlimited endpoints, unlimited requests, 30-day history, unlimited AI, replay |
| Team (future) | $19/mo | Shared endpoints, multiple users, 90-day history                              |

**Revenue targets:**

- Month 1-2: Validate. Get 50-100 free users, 5-10 paying.
- Month 3-6: $500-1000 MRR through content marketing and developer community presence.
- Month 6-12: $2000-5000 MRR if product-market fit holds. Add Team tier.

---

## Go-to-Market (Post-Launch)

**Week 1 after launch:**

- Product Hunt launch
- Reddit posts (r/webdev, r/SaaS, r/microsaas, r/node, r/python)
- Hacker News Show HN
- X/Twitter thread: "I built an AI webhook debugger in 2 weeks"
- Dev.to / Hashnode article

**Ongoing:**

- SEO content: "How to test Stripe webhooks", "Debugging GitHub webhooks", "Shopify webhook testing guide"
- Each article naturally features Websnag as the tool
- YouTube shorts / short tutorials showing the AI analysis in action
- Integration-specific landing pages (Websnag for Stripe, for GitHub, for Shopify)

---

## Risk Assessment

| Risk                              | Likelihood | Mitigation                                                            |
| --------------------------------- | ---------- | --------------------------------------------------------------------- |
| Crowded market, hard to stand out | High       | AI analysis is genuine differentiator. Lean into it in all marketing. |
| Low conversion free → paid        | Medium     | Keep free tier useful but limited enough to create upgrade pressure   |
| AI costs eat margin               | Low        | Sonnet is cheap. Rate limit free tier. Cache analyses.                |
| Scope creep beyond 2 weeks        | High       | This plan is the ceiling. Cut polish before cutting features.         |
| Supabase Realtime issues at scale | Low        | Won't matter until significant traction. Can migrate later.           |

---

## Decision Points

Before starting, nail these down:

1. **Name & domain** — Check availability for websnag.dev, hooklens.dev, webhookpilot.com
2. **Slug format** — Random (secure) vs user-chosen (memorable)? Recommend: random by default, custom slug for Pro.
3. **Request size limit** — 256KB? 1MB? Need to decide for free vs pro.
4. **AI auto-run vs manual** — Auto for Pro, manual "Analyze" button for free? Recommend yes.
