-- ════════════════════════════════════════════════════════════════════
-- FLUX PLANNER — EDUCATOR PLATFORM RLS LOCKDOWN
-- Tighten over-permissive policies so students can't enumerate every
-- class/assignment/announcement in the database. Adds a self-managed
-- `student_class_codes` table + SECURITY DEFINER helpers so the
-- "join class by code" UX still works without leaking the directory.
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1. Self-registered class codes (student-controlled subscription list)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_class_codes (
  student_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_code  TEXT NOT NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, class_code)
);

ALTER TABLE public.student_class_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scc_student_all" ON public.student_class_codes;
CREATE POLICY "scc_student_all" ON public.student_class_codes
  FOR ALL TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE INDEX IF NOT EXISTS idx_student_class_codes_code
  ON public.student_class_codes(class_code);

-- ──────────────────────────────────────────────────────────────────
-- 2. teacher_classes — drop wide read, require enrollment OR subscription
--    Joining a new class still works through `flux_lookup_class_by_code`.
-- ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "classes_student_read" ON public.teacher_classes;

CREATE POLICY "classes_student_read" ON public.teacher_classes
  FOR SELECT TO authenticated
  USING (
    active = true
    AND (
      EXISTS (
        SELECT 1 FROM public.teacher_students ts
        WHERE ts.student_id = auth.uid()
          AND ts.active = true
          AND (ts.class_code = public.teacher_classes.class_code
               OR ts.teacher_id = public.teacher_classes.teacher_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.student_class_codes scc
        WHERE scc.student_id = auth.uid()
          AND scc.class_code = public.teacher_classes.class_code
      )
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- 3. teacher_assignments — restrict to subscribed/enrolled students
-- ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "assignments_student_read" ON public.teacher_assignments;

CREATE POLICY "assignments_student_read" ON public.teacher_assignments
  FOR SELECT TO authenticated
  USING (
    visible = true
    AND (
      EXISTS (
        SELECT 1 FROM public.teacher_students ts
        WHERE ts.student_id = auth.uid()
          AND ts.active = true
          AND (ts.class_code = public.teacher_assignments.class_code
               OR ts.teacher_id = public.teacher_assignments.teacher_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.student_class_codes scc
        WHERE scc.student_id = auth.uid()
          AND scc.class_code = public.teacher_assignments.class_code
      )
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- 4. teacher_announcements — same enrollment gate (resolve via class_id)
-- ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "announce_student_read" ON public.teacher_announcements;

CREATE POLICY "announce_student_read" ON public.teacher_announcements
  FOR SELECT TO authenticated
  USING (
    visible = true
    AND class_id IS NOT NULL
    AND class_id IN (
      SELECT tc.id FROM public.teacher_classes tc
      WHERE
        EXISTS (
          SELECT 1 FROM public.teacher_students ts
          WHERE ts.student_id = auth.uid()
            AND ts.active = true
            AND (ts.class_code = tc.class_code OR ts.teacher_id = tc.teacher_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.student_class_codes scc
          WHERE scc.student_id = auth.uid()
            AND scc.class_code = tc.class_code
        )
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- 5. no_homework_days — same enrollment gate
-- ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "nhd_student_read" ON public.no_homework_days;

CREATE POLICY "nhd_student_read" ON public.no_homework_days
  FOR SELECT TO authenticated
  USING (
    class_id IS NOT NULL
    AND class_id IN (
      SELECT tc.id FROM public.teacher_classes tc
      WHERE
        EXISTS (
          SELECT 1 FROM public.teacher_students ts
          WHERE ts.student_id = auth.uid()
            AND ts.active = true
            AND (ts.class_code = tc.class_code OR ts.teacher_id = tc.teacher_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.student_class_codes scc
          WHERE scc.student_id = auth.uid()
            AND scc.class_code = tc.class_code
        )
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- 6. SECURITY DEFINER helpers: lookup-by-code & subscribe
--    Run with elevated privileges so the student gets a single row
--    they need to decide whether to join, without exposing the table.
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.flux_lookup_class_by_code(p_code TEXT)
RETURNS TABLE (
  id          UUID,
  class_name  TEXT,
  teacher_id  UUID,
  subject     TEXT,
  period      TEXT,
  active      BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, class_name, teacher_id, subject, period, active
  FROM public.teacher_classes
  WHERE class_code = p_code
    AND active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.flux_lookup_class_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_lookup_class_by_code(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.flux_subscribe_class(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_exists BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.teacher_classes
    WHERE class_code = p_code AND active = true
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.student_class_codes (student_id, class_code)
  VALUES (v_uid, p_code)
  ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.flux_subscribe_class(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_subscribe_class(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.flux_unsubscribe_class(p_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM public.student_class_codes
  WHERE student_id = auth.uid() AND class_code = p_code;
END;
$$;

REVOKE ALL ON FUNCTION public.flux_unsubscribe_class(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_unsubscribe_class(TEXT) TO authenticated;
