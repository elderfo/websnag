-- ============================================================================
-- 011_atomic_ai_analysis_increment.sql
-- Fixes: race condition in AI analysis usage check (pentest finding #2)
-- ============================================================================

-- Atomic AI analysis increment with limit check to prevent race conditions.
-- Returns TRUE if the analysis is within limit, FALSE if over limit.
-- p_limit <= 0 means unlimited (pro users).
CREATE OR REPLACE FUNCTION try_increment_ai_analysis_count(p_user_id UUID, p_limit INT)
RETURNS BOOLEAN AS $$
DECLARE
  current INT;
BEGIN
  INSERT INTO usage (user_id, month, ai_analysis_count)
  VALUES (p_user_id, to_char(now(), 'YYYY-MM'), 1)
  ON CONFLICT (user_id, month)
  DO UPDATE SET ai_analysis_count = usage.ai_analysis_count + 1
  RETURNING ai_analysis_count INTO current;

  IF p_limit <= 0 THEN
    RETURN TRUE;
  END IF;

  RETURN current <= p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Restrict execute to service_role only (called from admin client in analyze handler)
REVOKE EXECUTE ON FUNCTION try_increment_ai_analysis_count(UUID, INT) FROM public;
REVOKE EXECUTE ON FUNCTION try_increment_ai_analysis_count(UUID, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION try_increment_ai_analysis_count(UUID, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION try_increment_ai_analysis_count(UUID, INT) TO service_role;
