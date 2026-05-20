-- Teacher class isolation: one teacher per class row; students only see enrolled codes.

-- ── teacher_classes ───────────────────────────────────────────────
DROP POLICY IF EXISTS "classes_teacher_all" ON public.teacher_classes;
DROP POLICY IF EXISTS "classes_teacher_select" ON public.teacher_classes;
DROP POLICY IF EXISTS "classes_teacher_insert" ON public.teacher_classes;
DROP POLICY IF EXISTS "classes_teacher_update" ON public.teacher_classes;
DROP POLICY IF EXISTS "classes_teacher_delete" ON public.teacher_classes;
DROP POLICY IF EXISTS "classes_student_read" ON public.teacher_classes;
DROP POLICY IF EXISTS "classes_admin_read" ON public.teacher_classes;

CREATE POLICY "classes_teacher_select" ON public.teacher_classes
  FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY "classes_teacher_insert" ON public.teacher_classes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "classes_teacher_update" ON public.teacher_classes
  FOR UPDATE TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "classes_teacher_delete" ON public.teacher_classes
  FOR DELETE TO authenticated
  USING (auth.uid() = teacher_id);

-- Students: only classes they joined (by class_code), not every class a teacher owns.
CREATE POLICY "classes_student_read" ON public.teacher_classes
  FOR SELECT TO authenticated
  USING (
    active = true
    AND (
      EXISTS (
        SELECT 1 FROM public.teacher_students ts
        WHERE ts.student_id = auth.uid()
          AND ts.active = true
          AND ts.class_code IS NOT NULL
          AND ts.class_code = public.teacher_classes.class_code
      )
      OR EXISTS (
        SELECT 1 FROM public.student_class_codes scc
        WHERE scc.student_id = auth.uid()
          AND scc.class_code = public.teacher_classes.class_code
      )
    )
  );

CREATE POLICY "classes_admin_read" ON public.teacher_classes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- ── teacher_assignments (student read: match class_code only) ─────
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
          AND ts.class_code IS NOT NULL
          AND ts.class_code = public.teacher_assignments.class_code
      )
      OR EXISTS (
        SELECT 1 FROM public.student_class_codes scc
        WHERE scc.student_id = auth.uid()
          AND scc.class_code = public.teacher_assignments.class_code
      )
    )
  );

-- ── teacher_announcements ─────────────────────────────────────────
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
            AND ts.class_code IS NOT NULL
            AND ts.class_code = tc.class_code
        )
        OR EXISTS (
          SELECT 1 FROM public.student_class_codes scc
          WHERE scc.student_id = auth.uid()
            AND scc.class_code = tc.class_code
        )
    )
  );

-- ── no_homework_days ──────────────────────────────────────────────
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
            AND ts.class_code IS NOT NULL
            AND ts.class_code = tc.class_code
        )
        OR EXISTS (
          SELECT 1 FROM public.student_class_codes scc
          WHERE scc.student_id = auth.uid()
            AND scc.class_code = tc.class_code
        )
    )
  );

-- Join class by code: enroll student + subscribe for RLS (replaces wide table reads).
CREATE OR REPLACE FUNCTION public.flux_join_teacher_class(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  c RECORD;
  norm TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  norm := upper(trim(coalesce(p_code, '')));
  IF length(norm) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT id, class_name, class_code, teacher_id, subject, period, room, time_start, time_end, days, school_year
  INTO c
  FROM public.teacher_classes
  WHERE active = true AND upper(trim(class_code)) = norm
  LIMIT 1;

  IF c.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  INSERT INTO public.student_class_codes (student_id, class_code)
  VALUES (v_uid, c.class_code)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.teacher_students (
    teacher_id, student_id, class_name, class_code, period, school_year, active
  )
  VALUES (
    c.teacher_id, v_uid, c.class_name, c.class_code, c.period, coalesce(c.school_year, '2025-26'), true
  )
  ON CONFLICT (teacher_id, student_id, class_name)
  DO UPDATE SET
    class_code = EXCLUDED.class_code,
    period = EXCLUDED.period,
    active = true,
    joined_at = NOW();

  RETURN jsonb_build_object(
    'ok', true,
    'class_id', c.id,
    'class_name', c.class_name,
    'class_code', c.class_code,
    'teacher_id', c.teacher_id,
    'subject', c.subject,
    'period', c.period,
    'room', c.room,
    'time_start', c.time_start,
    'time_end', c.time_end,
    'days', c.days
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flux_join_teacher_class(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_join_teacher_class(TEXT) TO authenticated;
