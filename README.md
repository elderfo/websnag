# Websnag

AI-powered webhook debugger. Create private webhook endpoints, inspect incoming HTTP requests in real-time, and get AI-powered payload analysis.

## Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [pnpm](https://pnpm.io/) v9+
- A [Supabase](https://supabase.com/) project
- A [Stripe](https://stripe.com/) account (for billing features)
- An [Anthropic](https://console.anthropic.com/) API key (for AI analysis)

## Getting Started

### 1. Clone the repository

```bash
git clone git@github.com:elderfo/websnag.git
cd websnag
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:

| Variable                               | Where to find it                                               |
| -------------------------------------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase dashboard > Project Settings > API                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase dashboard > Project Settings > API Keys               |
| `SUPABASE_SECRET_KEY`                  | Supabase dashboard > Project Settings > API Keys (keep secret) |
| `ANTHROPIC_API_KEY`                    | [Anthropic Console](https://console.anthropic.com/) > API Keys |
| `STRIPE_SECRET_KEY`                    | Stripe dashboard > Developers > API keys                       |
| `STRIPE_WEBHOOK_SECRET`                | Generated when running `stripe listen` (see step 5)            |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`   | Stripe dashboard > Developers > API keys                       |
| `STRIPE_PRO_PRICE_ID`                  | Stripe dashboard > Products > Pro plan price ID                |
| `NEXT_PUBLIC_APP_URL`                  | `http://localhost:3000` for local dev                          |

### 4. Set up the database

Run the SQL migration files against your Supabase project in order:

1. Go to Supabase dashboard > SQL Editor
2. Run each file from `supabase/migrations/` in sequence:
   - `001_initial_schema.sql`
   - `002_rls_policies.sql`
   - `003_usage_functions.sql`

Then enable Realtime on the `requests` table:

1. Go to Supabase dashboard > Database > Replication
2. Enable the `requests` table for Realtime

### 5. Set up Stripe webhooks (optional, for billing)

Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and forward webhooks to your local server:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret it outputs into `STRIPE_WEBHOOK_SECRET` in `.env.local`.

### 6. Start the dev server

```bash
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Command           | Description                  |
| ----------------- | ---------------------------- |
| `pnpm dev`        | Start the Next.js dev server |
| `pnpm build`      | Create a production build    |
| `pnpm start`      | Run the production build     |
| `pnpm lint`       | Run ESLint                   |
| `pnpm format`     | Format code with Prettier    |
| `pnpm test`       | Run tests once               |
| `pnpm test:watch` | Run tests in watch mode      |

## Testing Webhook Capture

Once the app is running and you've created an endpoint, send test requests with cURL:

```bash
# POST with JSON body
curl -X POST http://localhost:3000/api/wh/YOUR_SLUG \
  -H "Content-Type: application/json" \
  -d '{"event": "test", "data": {"id": 123}}'

# GET with query params
curl "http://localhost:3000/api/wh/YOUR_SLUG?callback=true&verify=abc123"
```

## Tech Stack

- **Framework:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **Database/Auth/Realtime:** Supabase
- **AI:** Anthropic Claude API
- **Payments:** Stripe
- **Hosting:** Vercel
