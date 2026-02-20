-- Exposes retention job run history from cron.job_run_details via a SECURITY DEFINER
-- function so the Supabase JS client (which uses PostgREST) can read it without
-- requiring the cron schema to be exposed in db_extra_search_path.

CREATE OR REPLACE FUNCTION get_retention_job_runs(p_limit INT DEFAULT 5)
RETURNS TABLE (
  runid BIGINT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  status TEXT,
  return_message TEXT
) AS $$
BEGIN
  -- pg_cron stores job metadata in cron.job and execution history in
  -- cron.job_run_details. The job name lives on cron.job, so we join
  -- to filter by the known job name.
  RETURN QUERY
  SELECT jrd.runid, jrd.start_time, jrd.end_time, jrd.status, jrd.return_message
  FROM cron.job_run_details jrd
  JOIN cron.job j ON j.jobid = jrd.jobid
  WHERE j.jobname = 'cleanup-expired-requests'
  ORDER BY jrd.start_time DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, cron;
