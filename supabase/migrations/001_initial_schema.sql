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
  ai_analysis JSONB DEFAULT NULL
);

-- Usage tracking
CREATE TABLE usage (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  month TEXT NOT NULL,
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
