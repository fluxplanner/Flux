-- P8-HEALTH — Ops health / readiness panel (admin + owner).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_ops_health_panel', 'Admin system health widget — connectivity, flags, RLS snapshot', false, 'admin')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;

-- Extend RLS health snapshot to staff productivity + counselor support tables.
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
      'flux_feature_flags',
      'flux_product_events',
      'flux_processor_jobs',
      'staff_student_accommodations',
      'staff_counselor_private_notes',
      'staff_parent_contact_logs',
      'student_counselor_checkins',
      'counselor_referrals',
      'admin_duty_logs'
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
