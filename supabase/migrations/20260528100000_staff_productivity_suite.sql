-- P8 Staff Productivity Suite — accommodations (need-to-know), counselor private notes, parent contact logs.
-- Personal-life tools stay client-only (FluxPersonalHub). Roll back via feature flags.

-- ── Accommodations cheat-sheet (IEP/504 need-to-know, not full documents) ──
CREATE TABLE IF NOT EXISTS public.staff_student_accommodations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school          TEXT NOT NULL,
  student_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_context  TEXT,
  category        TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('iep', '504', 'ell', 'health', 'other')),
  need_to_know    TEXT NOT NULL,
  details_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_accom_school_student
  ON public.staff_student_accommodations(school, student_id) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_staff_accom_student
  ON public.staff_student_accommodations(student_id);

ALTER TABLE public.staff_student_accommodations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_accom_select_educator" ON public.staff_student_accommodations;
CREATE POLICY "staff_accom_select_educator" ON public.staff_student_accommodations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles viewer
      WHERE viewer.user_id = auth.uid()
        AND viewer.role IN ('teacher', 'counselor', 'staff', 'admin')
        AND NULLIF(trim(viewer.school), '') IS NOT NULL
        AND lower(trim(viewer.school)) = lower(trim(staff_student_accommodations.school))
        AND (
          viewer.role IN ('admin', 'counselor', 'staff')
          OR EXISTS (
            SELECT 1 FROM public.teacher_students ts
            WHERE ts.student_id = staff_student_accommodations.student_id
              AND ts.teacher_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM public.student_counselors sc
            JOIN public.counselors c ON c.id = sc.counselor_id
            WHERE sc.student_id = staff_student_accommodations.student_id
              AND c.user_id = auth.uid()
          )
        )
    )
  );

DROP POLICY IF EXISTS "staff_accom_write_educator" ON public.staff_student_accommodations;
CREATE POLICY "staff_accom_write_educator" ON public.staff_student_accommodations
  FOR ALL TO authenticated
  USING (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('teacher', 'counselor', 'staff', 'admin')
        AND lower(trim(ur.school)) = lower(trim(staff_student_accommodations.school))
    )
  )
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('teacher', 'counselor', 'staff', 'admin')
        AND lower(trim(ur.school)) = lower(trim(staff_student_accommodations.school))
    )
  );

-- ── Counselor meeting logs (RLS-locked; encryption_version for future client crypto) ──
CREATE TABLE IF NOT EXISTS public.staff_counselor_private_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school              TEXT NOT NULL,
  occurred_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note_body           TEXT NOT NULL,
  encryption_version  INT NOT NULL DEFAULT 0,
  meeting_type        TEXT NOT NULL DEFAULT 'check_in'
    CHECK (meeting_type IN ('check_in', 'crisis', 'schedule', 'parent', 'referral', 'other')),
  follow_up_on        DATE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_counsel_notes_counselor
  ON public.staff_counselor_private_notes(counselor_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_staff_counsel_notes_student
  ON public.staff_counselor_private_notes(student_id);

ALTER TABLE public.staff_counselor_private_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_counsel_notes_owner" ON public.staff_counselor_private_notes;
CREATE POLICY "staff_counsel_notes_owner" ON public.staff_counselor_private_notes
  FOR ALL TO authenticated
  USING (
    counselor_user_id = auth.uid()
    OR (
      public.flux_is_platform_admin()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'admin'
          AND lower(trim(ur.school)) = lower(trim(staff_counselor_private_notes.school))
      )
    )
  )
  WITH CHECK (counselor_user_id = auth.uid());

-- ── Parent contact log (timestamped, linked to student) ──
CREATE TABLE IF NOT EXISTS public.staff_parent_contact_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  educator_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school        TEXT NOT NULL,
  channel       TEXT NOT NULL DEFAULT 'email'
    CHECK (channel IN ('call', 'email', 'text', 'in_person', 'other')),
  summary       TEXT NOT NULL,
  contacted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_parent_log_student
  ON public.staff_parent_contact_logs(student_id, contacted_at DESC);

ALTER TABLE public.staff_parent_contact_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_parent_log_educator" ON public.staff_parent_contact_logs;
CREATE POLICY "staff_parent_log_educator" ON public.staff_parent_contact_logs
  FOR ALL TO authenticated
  USING (
    educator_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles viewer
      WHERE viewer.user_id = auth.uid()
        AND viewer.role IN ('counselor', 'admin')
        AND lower(trim(viewer.school)) = lower(trim(staff_parent_contact_logs.school))
    )
  )
  WITH CHECK (
    educator_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('teacher', 'counselor', 'staff', 'admin')
    )
  );

-- ── Feature flags (default off) ──
INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_staff_productivity_suite', 'Master flag: Human-Centered Staff Productivity OS', false, 'staff'),
  ('enable_classroom_tools', 'Quick-Grade buckets, accommodations cheat-sheet, classroom timer', false, 'teacher'),
  ('enable_caseload_engine', 'Counselor private meeting logs + caseload widgets', false, 'counselor'),
  ('enable_personal_hub', 'Personal-life tools (local-only, never synced to school DB)', false, 'staff'),
  ('enable_staff_command_v2', 'Staff command palette: modules, Drive, Gmail hooks', false, 'staff')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
