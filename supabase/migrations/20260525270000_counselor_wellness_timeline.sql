-- P4-TIMELINE: student wellness snapshots (mood + load + momentum) for consenting counselors.

ALTER TABLE public.student_counselors
  DROP CONSTRAINT IF EXISTS student_counselors_consent_tier_check;

ALTER TABLE public.student_counselors
  ADD CONSTRAINT student_counselors_consent_tier_check
  CHECK (consent_tier IN ('none', 'basic', 'wellness'));

COMMENT ON COLUMN public.student_counselors.consent_tier IS
  'none | basic (engagement band) | wellness (+ mood/load/momentum timeline)';

CREATE TABLE IF NOT EXISTS public.student_wellness_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date   DATE NOT NULL,
  mood            SMALLINT CHECK (mood IS NULL OR (mood >= 1 AND mood <= 5)),
  stress          SMALLINT CHECK (stress IS NULL OR (stress >= 1 AND stress <= 10)),
  sleep_hours     NUMERIC(4, 1),
  load_score      SMALLINT CHECK (load_score IS NULL OR (load_score >= 0 AND load_score <= 100)),
  momentum_score  SMALLINT CHECK (momentum_score IS NULL OR (momentum_score >= 0 AND momentum_score <= 100)),
  momentum_domains JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_sws_student_date
  ON public.student_wellness_snapshots (student_id, snapshot_date DESC);

ALTER TABLE public.student_wellness_snapshots ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.counselor_can_read_student_wellness(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_counselors sc
    JOIN public.counselors c ON c.id = sc.counselor_id
    WHERE sc.student_id = p_student_id
      AND c.user_id = auth.uid()
      AND sc.insights_consent = true
      AND sc.consent_tier = 'wellness'
  );
$$;

DROP POLICY IF EXISTS "sws_student_all" ON public.student_wellness_snapshots;
CREATE POLICY "sws_student_all" ON public.student_wellness_snapshots
  FOR ALL TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "sws_counselor_select" ON public.student_wellness_snapshots;
CREATE POLICY "sws_counselor_select" ON public.student_wellness_snapshots
  FOR SELECT TO authenticated
  USING (public.counselor_can_read_student_wellness(student_id));

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_counselor_wellness_timeline', 'Counselor student wellness timeline (mood + load + momentum, consent tier wellness)', false, 'counselor')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
