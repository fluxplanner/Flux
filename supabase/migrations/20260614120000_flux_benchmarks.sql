-- Flux Benchmarks: anonymized, aggregated population priors that make the
-- Intelligence engines + AI smarter WITHOUT training a model.
--
-- Privacy model (non-negotiable — users are minors):
--   • Aggregation only ever includes users who explicitly opted in
--     (user_data.data.settings.share_anon_stats = true).
--   • Only counts/ratios are stored — never raw text, titles, or identities.
--   • Buckets with a small sample (k-anonymity, n < 20) are suppressed by the
--     compute-benchmarks Edge Function before they are written here.
--   • Everyone can READ benchmarks (they're aggregate, non-identifying) so the
--     whole product gets smarter; only opted-in data CONTRIBUTES.

CREATE TABLE IF NOT EXISTS public.flux_benchmarks (
  key          TEXT PRIMARY KEY,        -- e.g. 'late_task_miss_rate'
  value        NUMERIC NOT NULL,        -- the statistic (ratio 0-1, or a number)
  unit         TEXT,                    -- 'ratio' | 'minutes' | 'count'
  sample_size  INTEGER NOT NULL,        -- n behind the statistic
  label        TEXT,                    -- human-readable prior for prompts/UI
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flux_benchmarks ENABLE ROW LEVEL SECURITY;

-- Aggregate, non-identifying → readable by any authenticated user.
DROP POLICY IF EXISTS "fb_read_all" ON public.flux_benchmarks;
CREATE POLICY "fb_read_all" ON public.flux_benchmarks
  FOR SELECT TO authenticated USING (true);

-- Only the service role (Edge Function) writes. No client INSERT/UPDATE policy
-- is created, so RLS denies all client writes by default.

-- Read helper: returns only well-supported benchmarks (defense in depth on top
-- of the Edge Function's own k-anonymity suppression).
CREATE OR REPLACE FUNCTION public.get_benchmarks()
RETURNS TABLE (key TEXT, value NUMERIC, unit TEXT, sample_size INTEGER, label TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT key, value, unit, sample_size, label
  FROM public.flux_benchmarks
  WHERE sample_size >= 20;
$$;

REVOKE ALL ON FUNCTION public.get_benchmarks() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_benchmarks() TO authenticated;

-- ── Schedule nightly recompute (requires pg_cron + pg_net; safe to skip if the
--    extensions aren't enabled — the table/RPC still work, just won't refresh). ──
-- Enable once in the dashboard: Database → Extensions → pg_cron, pg_net.
-- Then set the service-role key + project ref below and uncomment:
--
-- select cron.schedule(
--   'flux-benchmarks-nightly', '17 3 * * *',
--   $$ select net.http_post(
--        url    := 'https://<PROJECT_REF>.supabase.co/functions/v1/compute-benchmarks',
--        headers:= jsonb_build_object('Authorization','Bearer <SERVICE_ROLE_KEY>','Content-Type','application/json'),
--        body   := '{}'::jsonb
--      ); $$
-- );
