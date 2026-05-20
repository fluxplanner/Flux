-- P4-CONSENT: visibility tiers + audit trail for counselor insights sharing.

CREATE TABLE IF NOT EXISTS public.counselor_consent_audit (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  counselor_id   UUID NOT NULL REFERENCES public.counselors(id) ON DELETE CASCADE,
  previous_tier  TEXT NOT NULL DEFAULT 'none',
  new_tier       TEXT NOT NULL,
  changed_by     UUID NOT NULL REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT counselor_consent_audit_tier_prev CHECK (previous_tier IN ('none', 'basic', 'wellness')),
  CONSTRAINT counselor_consent_audit_tier_new CHECK (new_tier IN ('none', 'basic', 'wellness'))
);

CREATE INDEX IF NOT EXISTS idx_counselor_consent_audit_student
  ON public.counselor_consent_audit (student_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_counselor_consent_audit_counselor
  ON public.counselor_consent_audit (counselor_id, created_at DESC);

ALTER TABLE public.counselor_consent_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cca_student_insert" ON public.counselor_consent_audit;
CREATE POLICY "cca_student_insert" ON public.counselor_consent_audit
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND auth.uid() = changed_by
    AND EXISTS (
      SELECT 1 FROM public.student_counselors sc
      WHERE sc.student_id = counselor_consent_audit.student_id
        AND sc.counselor_id = counselor_consent_audit.counselor_id
    )
  );

DROP POLICY IF EXISTS "cca_student_select" ON public.counselor_consent_audit;
CREATE POLICY "cca_student_select" ON public.counselor_consent_audit
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "cca_counselor_select" ON public.counselor_consent_audit;
CREATE POLICY "cca_counselor_select" ON public.counselor_consent_audit
  FOR SELECT TO authenticated
  USING (
    counselor_id IN (SELECT id FROM public.counselors WHERE user_id = auth.uid())
  );

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_counselor_consent_flows', 'Student visibility tier picker + consent audit for counselor insights', false, 'counselor')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
