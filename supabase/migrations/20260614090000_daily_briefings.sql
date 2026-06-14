-- Flux daily briefings: one server-computed Intelligence briefing per user per
-- day, produced overnight by the daily-briefing Edge Function (pg_cron → pg_net).
-- The client reads today's row and shows it in the briefing banner; absent a
-- row it falls back to computing locally, so this is purely additive.

CREATE TABLE IF NOT EXISTS public.flux_daily_briefings (
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_date DATE NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  seen       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, brief_date)
);

ALTER TABLE public.flux_daily_briefings ENABLE ROW LEVEL SECURITY;

-- Users read and acknowledge (seen) only their own briefings.
DROP POLICY IF EXISTS "fdb_read_own" ON public.flux_daily_briefings;
CREATE POLICY "fdb_read_own" ON public.flux_daily_briefings
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "fdb_update_own" ON public.flux_daily_briefings;
CREATE POLICY "fdb_update_own" ON public.flux_daily_briefings
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Writes come only from the Edge Function (service role bypasses RLS); no
-- INSERT policy for normal users on purpose.

CREATE INDEX IF NOT EXISTS idx_fdb_date ON public.flux_daily_briefings (brief_date);

-- ─────────────────────────────────────────────────────────────────────────
-- Overnight schedule. Requires the pg_cron + pg_net extensions (enable them in
-- Dashboard → Database → Extensions), and two values filled in below:
--   • <FUNCTIONS_BASE>  e.g. https://lfigdijuqmbensebnevo.supabase.co/functions/v1
--   • <CRON_SECRET>     the same value set as the function's CRON_SECRET secret
-- Run this block AFTER deploying the daily-briefing function.
-- ─────────────────────────────────────────────────────────────────────────

-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- CREATE EXTENSION IF NOT EXISTS pg_net;
--
-- SELECT cron.schedule(
--   'flux-daily-briefing',
--   '0 6 * * *',                       -- 06:00 UTC daily; adjust to your timezone
--   $$
--   SELECT net.http_post(
--     url     := '<FUNCTIONS_BASE>/daily-briefing',
--     headers := jsonb_build_object(
--                  'Content-Type', 'application/json',
--                  'x-cron-secret', '<CRON_SECRET>'
--                ),
--     body    := '{}'::jsonb
--   );
--   $$
-- );
