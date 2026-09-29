-- Fix: every authenticated read of user_roles fails in production.
--
-- Two SELECT policies on user_roles query user_roles inside their own USING
-- expression, so Postgres re-enters policy evaluation and gives up with
--   42P17  infinite recursion detected in policy for relation "user_roles"
-- That fires for *any* select, including a user reading their own single row,
-- which means:
--   * FluxRole.load() fails. It is wrapped in try/catch, so it fails silently
--     and everyone falls back to 'student' — teachers, counselors, staff and
--     admins all lose their role and the whole educator platform with it.
--   * Staff signup cannot finish. The user_roles upsert in
--     flux-staff-platform.js needs ON CONFLICT, which reads the row first, so
--     it dies on the same recursion and leaves an auth user with no role row.
--
-- The fix is the pattern already used by flux_is_platform_admin(): do the
-- lookup in a SECURITY DEFINER function, which is not subject to the policies
-- on the table it reads. Both helpers only ever read the caller's own row, so
-- this grants no visibility that the policies did not already intend.
--
-- Rollback — restore the recursive definitions (and reintroduce the outage):
--   DROP POLICY roles_select_as_admin ON public.user_roles;
--   CREATE POLICY roles_select_as_admin ON public.user_roles FOR SELECT USING (
--     EXISTS (SELECT 1 FROM user_roles me
--             WHERE me.user_id = auth.uid() AND me.role = 'admin'));
--   DROP POLICY roles_select_educators_same_school ON public.user_roles;
--   CREATE POLICY roles_select_educators_same_school ON public.user_roles FOR SELECT USING (
--     (role = ANY (ARRAY['teacher','counselor','staff','admin']))
--     AND EXISTS (SELECT 1 FROM user_roles viewer
--                 WHERE viewer.user_id = auth.uid()
--                   AND NULLIF(TRIM(BOTH FROM viewer.school), '') IS NOT NULL
--                   AND NULLIF(TRIM(BOTH FROM user_roles.school), '') IS NOT NULL
--                   AND lower(TRIM(BOTH FROM viewer.school)) = lower(TRIM(BOTH FROM user_roles.school))));

-- ── helpers ────────────────────────────────────────────────────────────────
-- STABLE so the planner calls them once per statement rather than per row.

CREATE OR REPLACE FUNCTION public.flux_my_role()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.flux_my_school()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
  SELECT NULLIF(btrim(school), '')
  FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$function$;

-- anon must not be able to probe the directory through these.
REVOKE ALL ON FUNCTION public.flux_my_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.flux_my_school() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.flux_my_school() TO authenticated;

-- ── policies ───────────────────────────────────────────────────────────────
-- Same intent as before, minus the self-reference.

DROP POLICY IF EXISTS roles_select_as_admin ON public.user_roles;
CREATE POLICY roles_select_as_admin ON public.user_roles
  FOR SELECT
  USING (public.flux_my_role() = 'admin');

DROP POLICY IF EXISTS roles_select_educators_same_school ON public.user_roles;
CREATE POLICY roles_select_educators_same_school ON public.user_roles
  FOR SELECT
  USING (
    (role = ANY (ARRAY['teacher', 'counselor', 'staff', 'admin']))
    AND NULLIF(btrim(school), '') IS NOT NULL
    AND public.flux_my_school() IS NOT NULL
    AND lower(btrim(school)) = lower(public.flux_my_school())
  );
