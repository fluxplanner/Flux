-- P4-COUNSELOR-AI: counselor copilot (summaries only) + audit log.

CREATE TABLE IF NOT EXISTS public.counselor_copilot_audit (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id      UUID NOT NULL REFERENCES public.counselors(id) ON DELETE CASCADE,
  counselor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt_summary    TEXT NOT NULL,
  reply_summary     TEXT,
  context_snapshot  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT counselor_copilot_audit_prompt_len CHECK (char_length(prompt_summary) BETWEEN 1 AND 512),
  CONSTRAINT counselor_copilot_audit_reply_len CHECK (
    reply_summary IS NULL OR char_length(reply_summary) <= 512
  )
);

CREATE INDEX IF NOT EXISTS idx_counselor_copilot_audit_counselor
  ON public.counselor_copilot_audit (counselor_id, created_at DESC);

ALTER TABLE public.counselor_copilot_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ccai_counselor_insert" ON public.counselor_copilot_audit;
CREATE POLICY "ccai_counselor_insert" ON public.counselor_copilot_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    counselor_user_id = auth.uid()
    AND counselor_id IN (SELECT id FROM public.counselors WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "ccai_counselor_select" ON public.counselor_copilot_audit;
CREATE POLICY "ccai_counselor_select" ON public.counselor_copilot_audit
  FOR SELECT TO authenticated
  USING (
    counselor_user_id = auth.uid()
    OR counselor_id IN (SELECT id FROM public.counselors WHERE user_id = auth.uid())
  );

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_counselor_copilot', 'Counselor copilot — caseload summaries only, audit log', false, 'counselor')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
