-- P7-AI-ORCH: multi-agent routing layer (client) + optional run audit rows.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_ai_orchestration',
    'Multi-agent AI routing — role-aware specialists on top of FluxOrchestrator',
    false,
    'platform'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.flux_ai_agent_runs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id   TEXT NOT NULL,
  secondary  TEXT,
  intent     TEXT,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT flux_ai_agent_runs_agent_len CHECK (char_length(agent_id) BETWEEN 1 AND 64),
  CONSTRAINT flux_ai_agent_runs_secondary_len CHECK (secondary IS NULL OR char_length(secondary) <= 64),
  CONSTRAINT flux_ai_agent_runs_intent_len CHECK (intent IS NULL OR char_length(intent) <= 64)
);

CREATE INDEX IF NOT EXISTS idx_flux_ai_agent_runs_user_created
  ON public.flux_ai_agent_runs (user_id, created_at DESC);

ALTER TABLE public.flux_ai_agent_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flux_ai_agent_runs_insert_own" ON public.flux_ai_agent_runs;
CREATE POLICY "flux_ai_agent_runs_insert_own" ON public.flux_ai_agent_runs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "flux_ai_agent_runs_select_own" ON public.flux_ai_agent_runs;
CREATE POLICY "flux_ai_agent_runs_select_own" ON public.flux_ai_agent_runs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "flux_ai_agent_runs_admin_read" ON public.flux_ai_agent_runs;
CREATE POLICY "flux_ai_agent_runs_admin_read" ON public.flux_ai_agent_runs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.flux_record_agent_runs(p_runs JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  cnt INT;
  run JSONB;
  aid TEXT;
  sec TEXT;
  intent TEXT;
  epayload JSONB;
  inserted INT := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_runs IS NULL OR jsonb_typeof(p_runs) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  cnt := jsonb_array_length(p_runs);
  IF cnt < 1 OR cnt > 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_size');
  END IF;

  FOR run IN SELECT * FROM jsonb_array_elements(p_runs)
  LOOP
    aid := left(trim(coalesce(run->>'agent_id', '')), 64);
    IF aid = '' THEN
      CONTINUE;
    END IF;
    sec := left(nullif(trim(run->>'secondary'), ''), 64);
    intent := left(nullif(trim(run->>'intent'), ''), 64);
    epayload := coalesce(run->'payload', '{}'::jsonb);
    IF octet_length(epayload::text) > 2048 THEN
      epayload := jsonb_build_object('_truncated', true);
    END IF;

    INSERT INTO public.flux_ai_agent_runs (user_id, agent_id, secondary, intent, payload)
    VALUES (uid, aid, sec, intent, epayload);
    inserted := inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'accepted', inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_record_agent_runs(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_record_agent_runs(JSONB) TO authenticated;
