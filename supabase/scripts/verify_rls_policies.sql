-- Flux Planner — RLS verification (run in Supabase SQL Editor as postgres or admin test user)
-- See docs/P1-RLS-VERIFICATION.md

-- 1) Policy inventory for educator tables
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'user_roles',
    'teacher_classes',
    'teacher_assignments',
    'teacher_students',
    'student_class_codes',
    'student_completions',
    'flux_product_events'
  )
ORDER BY tablename, policyname;

-- 2) Legacy policies must NOT exist (expect 0 rows)
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN ('roles_select_educators', 'classes_teacher_all');

-- 3) Admin health snapshot (sign in as admin in app, then call via RPC or run as service role)
-- SELECT public.flux_rls_health_snapshot();

-- 4) Manual cross-tenant checks (replace UUIDs with test accounts)
-- As Student A JWT: should return only enrolled classes
-- SELECT id, class_name, teacher_id FROM public.teacher_classes;

-- As Teacher T JWT: should return only T's classes
-- SELECT id, class_name FROM public.teacher_classes;
