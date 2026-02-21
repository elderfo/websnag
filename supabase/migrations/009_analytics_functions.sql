-- Analytics aggregation functions
-- Server-side SQL aggregation to replace client-side computation

-- Request volume grouped by day
CREATE OR REPLACE FUNCTION get_volume_by_day(p_user_id UUID, p_days INT)
RETURNS TABLE (day DATE, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT DATE(r.received_at) AS day, COUNT(*) AS count
  FROM requests r
  WHERE r.endpoint_id IN (SELECT id FROM endpoints WHERE user_id = p_user_id)
    AND r.received_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY DATE(r.received_at)
  ORDER BY day ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Request count grouped by HTTP method
CREATE OR REPLACE FUNCTION get_method_breakdown(p_user_id UUID, p_days INT)
RETURNS TABLE (method TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT r.method, COUNT(*) AS count
  FROM requests r
  WHERE r.endpoint_id IN (SELECT id FROM endpoints WHERE user_id = p_user_id)
    AND r.received_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY r.method
  ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Top endpoints by request count
CREATE OR REPLACE FUNCTION get_top_endpoints(p_user_id UUID, p_days INT, p_limit INT DEFAULT 5)
RETURNS TABLE (endpoint_id UUID, endpoint_name TEXT, endpoint_slug TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT e.id AS endpoint_id, e.name AS endpoint_name, e.slug AS endpoint_slug, COUNT(*) AS count
  FROM requests r
  JOIN endpoints e ON e.id = r.endpoint_id
  WHERE e.user_id = p_user_id
    AND r.received_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY e.id, e.name, e.slug
  ORDER BY count DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
