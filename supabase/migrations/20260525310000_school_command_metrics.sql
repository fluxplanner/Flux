-- P5-COMMAND: admin school command center aggregate metrics (RPC, no row PII).

CREATE OR REPLACE FUNCTION public.flux_school_command_metrics()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  is_admin BOOLEAN;
  today DATE := CURRENT_DATE;
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

  RETURN jsonb_build_object(
    'ok', true,
    'generated_at', NOW(),
    'roles', (
      SELECT jsonb_build_object(
        'student', COUNT(*) FILTER (WHERE role = 'student'),
        'teacher', COUNT(*) FILTER (WHERE role = 'teacher'),
        'counselor', COUNT(*) FILTER (WHERE role = 'counselor'),
        'staff', COUNT(*) FILTER (WHERE role IN ('staff', 'admin'))
      )
      FROM public.user_roles
    ),
    'active_classes', (SELECT COUNT(*)::int FROM public.teacher_classes WHERE active = true),
    'assignments', (SELECT COUNT(*)::int FROM public.teacher_assignments),
    'submissions_pending', (
      SELECT COUNT(*)::int FROM public.student_completions WHERE status = 'submitted'
    ),
    'joins_pending', (
      SELECT COUNT(*)::int FROM public.class_join_requests WHERE status = 'pending'
    ),
    'recovery_proposed', (
      SELECT COUNT(*)::int FROM public.assignment_recovery_plans WHERE status = 'proposed'
    ),
    'appts_today', (
      SELECT COUNT(*)::int FROM public.counselor_appointments
      WHERE date = today AND status NOT IN ('cancelled', 'no_show')
    ),
    'appts_pending', (
      SELECT COUNT(*)::int FROM public.counselor_appointments
      WHERE status = 'pending' AND date >= today
    ),
    'counselor_links', (SELECT COUNT(*)::int FROM public.student_counselors),
    'consent_basic', (
      SELECT COUNT(*)::int FROM public.student_counselors
      WHERE insights_consent = true AND consent_tier = 'basic'
    ),
    'consent_wellness', (
      SELECT COUNT(*)::int FROM public.student_counselors
      WHERE insights_consent = true AND consent_tier = 'wellness'
    ),
    'wellness_snapshots_7d', (
      SELECT COUNT(*)::int FROM public.student_wellness_snapshots
      WHERE snapshot_date >= today - 7
    ),
    'meeting_requests_pending', (
      SELECT COUNT(*)::int FROM public.admin_meeting_requests WHERE status = 'pending'
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flux_school_command_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_school_command_metrics() TO authenticated;
