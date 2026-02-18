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
