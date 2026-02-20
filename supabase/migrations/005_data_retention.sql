-- Data retention cleanup function
-- Deletes expired requests based on subscription tier:
--   Free tier (no active pro subscription): 24 hours
--   Pro tier (active pro subscription): 30 days

CREATE OR REPLACE FUNCTION cleanup_expired_requests()
RETURNS TABLE (free_deleted BIGINT, pro_deleted BIGINT) AS $$
DECLARE
  v_free_deleted BIGINT;
  v_pro_deleted BIGINT;
BEGIN
  -- Delete free-tier requests older than 24 hours
  -- Free tier = no subscription row, or plan != 'pro', or status != 'active'
  WITH deleted AS (
    DELETE FROM requests r
    WHERE r.received_at < now() - interval '24 hours'
      AND r.endpoint_id IN (
        SELECT e.id FROM endpoints e
        LEFT JOIN subscriptions s ON s.user_id = e.user_id AND s.plan = 'pro' AND s.status = 'active'
        WHERE s.user_id IS NULL
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_free_deleted FROM deleted;

  -- Delete pro-tier requests older than 30 days
  WITH deleted AS (
    DELETE FROM requests r
    WHERE r.received_at < now() - interval '30 days'
      AND r.endpoint_id IN (
        SELECT e.id FROM endpoints e
        INNER JOIN subscriptions s ON s.user_id = e.user_id
        WHERE s.plan = 'pro' AND s.status = 'active'
      )
    RETURNING 1
  )
  SELECT count(*) INTO v_pro_deleted FROM deleted;

  free_deleted := v_free_deleted;
  pro_deleted := v_pro_deleted;
  RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Composite index to optimize retention queries by received_at and endpoint_id
CREATE INDEX idx_requests_retention ON requests (received_at, endpoint_id);

-- Schedule daily cleanup at 3:00 AM UTC via pg_cron (if available)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    PERFORM cron.schedule(
      'cleanup-expired-requests',
      '0 3 * * *',
      'SELECT cleanup_expired_requests()'
    );
  ELSE
    RAISE NOTICE 'pg_cron is not available — schedule cleanup_expired_requests() manually or via an external scheduler';
  END IF;
END;
$$;
