-- P0 A5 — daily rate guard for the AI proxies.
--
-- ai-proxy/gemini-proxy previously proceeded with userId = null when the JWT
-- check failed and PAYMENTS_ENABLED != "true": anyone holding the public anon
-- key could burn provider quota. The proxies now always require a valid user
-- JWT except a narrow guest-mode allowance metered against this table
-- (per-IP+fingerprint, ~20 req/day, lower model tier), plus a per-user daily
-- abuse stop even when payment metering is off.
--
-- Access model: RLS enabled with NO policies — anon/authenticated cannot touch
-- the table; only the service role (which the edge functions use via the
-- SECURITY DEFINER RPC below) can. See docs/RLS_AUDIT.md §11.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.flux_bump_ai_guard(text);
--   DROP TABLE IF EXISTS public.flux_ai_guard;

CREATE TABLE IF NOT EXISTS public.flux_ai_guard (
  bucket     text        NOT NULL,
  day        date        NOT NULL DEFAULT current_date,
  count      integer     NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (bucket, day)
);

ALTER TABLE public.flux_ai_guard ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: service-role only.

-- Atomic increment + TTL self-clean (rows older than 2 days are dead weight).
CREATE OR REPLACE FUNCTION public.flux_bump_ai_guard(p_bucket text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO flux_ai_guard AS g (bucket, day, count)
  VALUES (p_bucket, current_date, 1)
  ON CONFLICT (bucket, day)
  DO UPDATE SET count = g.count + 1, updated_at = now()
  RETURNING count INTO n;

  -- Probabilistic TTL sweep so no cron is needed.
  IF random() < 0.02 THEN
    DELETE FROM flux_ai_guard WHERE day < current_date - 2;
  END IF;

  RETURN n;
END;
$$;

-- Only the service role may call the RPC (edge functions); never clients.
REVOKE ALL ON FUNCTION public.flux_bump_ai_guard(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.flux_bump_ai_guard(text) FROM anon;
REVOKE ALL ON FUNCTION public.flux_bump_ai_guard(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.flux_bump_ai_guard(text) TO service_role;
