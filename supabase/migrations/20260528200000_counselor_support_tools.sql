-- P8.5 Counselor support — wellness check-ins (student → counselor) + referral tracker.

CREATE TABLE IF NOT EXISTS public.student_counselor_checkins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  counselor_id  UUID NOT NULL REFERENCES public.counselors(id) ON DELETE CASCADE,
  school        TEXT NOT NULL,
  message       TEXT,
  severity      TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high')),
  status        TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'acknowledged', 'resolved')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scc_counselor_status
  ON public.student_counselor_checkins(counselor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scc_student
  ON public.student_counselor_checkins(student_id, created_at DESC);

ALTER TABLE public.student_counselor_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scc_student_insert" ON public.student_counselor_checkins;
CREATE POLICY "scc_student_insert" ON public.student_counselor_checkins
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.student_counselors sc
      WHERE sc.student_id = auth.uid()
        AND sc.counselor_id = student_counselor_checkins.counselor_id
    )
  );

DROP POLICY IF EXISTS "scc_student_read_own" ON public.student_counselor_checkins;
CREATE POLICY "scc_student_read_own" ON public.student_counselor_checkins
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "scc_counselor_all" ON public.student_counselor_checkins;
CREATE POLICY "scc_counselor_all" ON public.student_counselor_checkins
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.counselors c
      WHERE c.id = student_counselor_checkins.counselor_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.counselors c
      WHERE c.id = student_counselor_checkins.counselor_id
        AND c.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS public.counselor_referrals (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school            TEXT NOT NULL,
  referred_to       TEXT NOT NULL
    CHECK (referred_to IN ('school_psych', 'admin', 'crisis_team', 'external', 'other')),
  status            TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'in_review', 'complete', 'cancelled')),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_counselor_referrals_counselor
  ON public.counselor_referrals(counselor_user_id, status);

ALTER TABLE public.counselor_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cref_counselor_all" ON public.counselor_referrals;
CREATE POLICY "cref_counselor_all" ON public.counselor_referrals
  FOR ALL TO authenticated
  USING (counselor_user_id = auth.uid())
  WITH CHECK (counselor_user_id = auth.uid());

DROP POLICY IF EXISTS "cref_admin_read" ON public.counselor_referrals;
CREATE POLICY "cref_admin_read" ON public.counselor_referrals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND lower(trim(ur.school)) = lower(trim(counselor_referrals.school))
    )
  );
