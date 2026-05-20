-- P1-RLS: Remove legacy wide policies; secure join preview labels; admin health snapshot.

-- ── Drop legacy over-permissive policies (no-op if already removed) ──
DROP POLICY IF EXISTS "roles_select_educators" ON public.user_roles;
DROP POLICY IF EXISTS "classes_teacher_all" ON public.teacher_classes;

-- ── Class lookup: include teacher display name (avoids user_roles RLS leak/enumeration) ──
DROP FUNCTION IF EXISTS public.flux_lookup_class_by_code(TEXT);

CREATE OR REPLACE FUNCTION public.flux_lookup_class_by_code(p_code TEXT)
RETURNS TABLE (
  id                   UUID,
  class_name           TEXT,
  teacher_id           UUID,
  teacher_display_name TEXT,
  subject              TEXT,
  period               TEXT,
  room                 TEXT,
  time_start           TEXT,
  time_end             TEXT,
  days                 TEXT,
  active               BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    tc.id,
    tc.class_name,
    tc.teacher_id,
    ur.display_name AS teacher_display_name,
    tc.subject,
    tc.period,
    tc.room,
    tc.time_start,
    tc.time_end,
    tc.days,
    tc.active
  FROM public.teacher_classes tc
  LEFT JOIN public.user_roles ur ON ur.user_id = tc.teacher_id
  WHERE tc.class_code = p_code
    AND tc.active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.flux_lookup_class_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_lookup_class_by_code(TEXT) TO authenticated;

-- ── Join by code: return teacher label for UI ──
CREATE OR REPLACE FUNCTION public.flux_join_teacher_class(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  c RECORD;
  tname TEXT;
  norm TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  norm := upper(trim(coalesce(p_code, '')));
  IF length(norm) < 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT
    tc.id,
    tc.class_name,
    tc.class_code,
    tc.teacher_id,
    tc.subject,
    tc.period,
    tc.room,
    tc.time_start,
    tc.time_end,
    tc.days,
    tc.school_year,
    ur.display_name AS teacher_display_name
  INTO c
  FROM public.teacher_classes tc
  LEFT JOIN public.user_roles ur ON ur.user_id = tc.teacher_id
  WHERE tc.active = true AND upper(trim(tc.class_code)) = norm
  LIMIT 1;

  IF c.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  tname := coalesce(nullif(trim(c.teacher_display_name), ''), 'Teacher');

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
    'teacher_display_name', tname,
    'subject', c.subject,
    'period', c.period,
    'room', c.room,
    'time_start', c.time_start,
    'time_end', c.time_end,
    'days', c.days
  );
END;
$$;

-- ── Admin / owner: policy snapshot for RLS audit (no row data) ──
CREATE OR REPLACE FUNCTION public.flux_rls_health_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  is_admin BOOLEAN;
  policies JSONB;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = uid AND ur.role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'table', tablename,
    'policy', policyname,
    'cmd', cmd
  ) ORDER BY tablename, policyname), '[]'::jsonb)
  INTO policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'user_roles',
      'teacher_classes',
      'teacher_assignments',
      'teacher_students',
      'student_class_codes',
      'student_completions',
      'flux_feature_flags'
    );

  RETURN jsonb_build_object(
    'ok', true,
    'checked_at', NOW(),
    'legacy_roles_select_educators', EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'user_roles'
        AND policyname = 'roles_select_educators'
    ),
    'legacy_classes_teacher_all', EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'teacher_classes'
        AND policyname = 'classes_teacher_all'
    ),
    'policies', policies
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flux_rls_health_snapshot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_rls_health_snapshot() TO authenticated;
