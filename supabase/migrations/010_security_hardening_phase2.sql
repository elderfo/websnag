-- ============================================================================
-- 010_security_hardening_phase2.sql
-- Fixes: #78 (search_path), #69 (DELETE RLS), #73 (usage race condition)
-- ============================================================================

-- #78: Set search_path on SECURITY DEFINER functions to prevent search_path hijacking
ALTER FUNCTION increment_request_count(UUID) SET search_path = public;
ALTER FUNCTION increment_ai_analysis_count(UUID) SET search_path = public;
ALTER FUNCTION get_current_usage(UUID) SET search_path = public;

-- #69: Add missing DELETE RLS policy on requests table
CREATE POLICY "Users can delete requests for own endpoints"
  ON requests FOR DELETE
  USING (endpoint_id IN (SELECT id FROM endpoints WHERE user_id = auth.uid()));

-- #73: Atomic usage increment with limit check to prevent race conditions
-- Returns TRUE if the request is within limit, FALSE if over limit.
-- p_limit <= 0 means unlimited (pro users).
CREATE OR REPLACE FUNCTION try_increment_request_count(p_user_id UUID, p_limit INT)
RETURNS BOOLEAN AS $$
DECLARE
  current INT;
BEGIN
  INSERT INTO usage (user_id, month, request_count)
  VALUES (p_user_id, to_char(now(), 'YYYY-MM'), 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET request_count = usage.request_count + 1
  RETURNING request_count INTO current;

  IF p_limit <= 0 THEN
    RETURN TRUE;
  END IF;

  RETURN current <= p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
