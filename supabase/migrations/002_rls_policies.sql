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

-- Usage: users see only their own
CREATE POLICY "Users can view own usage"
  ON usage FOR SELECT USING (auth.uid() = user_id);

-- Subscriptions: users see only their own
CREATE POLICY "Users can view own subscription"
  ON subscriptions FOR SELECT USING (auth.uid() = user_id);
