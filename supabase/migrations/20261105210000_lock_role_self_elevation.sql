-- Security fix, 2026-11-05 incident.
--
-- Any signed-in account could make itself an admin from the browser console:
--   sb.from('user_roles').update({ role: 'admin' }).eq('user_id', myId)
-- because roles_update_own and roles_insert_own only checked whose row it was,
-- not what the row was being changed to. Row policies cannot compare old and
-- new values, so the rule lives in triggers. Requests from the browser are held
-- to it; the service role (release-admin) and the platform owner are not.

-- Owner rights come from the fixed user id only. The stored email address is no
-- longer anyone's login, so matching on it would hand the owner's rights to
-- whoever registered that address.
CREATE OR REPLACE FUNCTION public.flux_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.flux_request_is_from_browser()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT coalesce(auth.role(), '') IN ('anon', 'authenticated');
$function$;

-- A browser request may keep its role or drop to student. Moving to any other
-- role needs a staff request the owner has approved for exactly that role.
-- Anything else keeps the old role rather than raising an error, so the name
-- and school saved in the same upsert during sign-up still go through.
CREATE OR REPLACE FUNCTION public.flux_guard_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_previous text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.role ELSE 'student' END;
BEGIN
  IF NOT public.flux_request_is_from_browser() OR public.flux_is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS NOT DISTINCT FROM v_previous OR NEW.role = 'student' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.staff_verification_requests svr
    WHERE svr.user_id = NEW.user_id
      AND svr.verification_status = 'approved'
      AND svr.requested_role = NEW.role
  ) THEN
    RETURN NEW;
  END IF;
  NEW.role := v_previous;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS flux_guard_user_role ON public.user_roles;
CREATE TRIGGER flux_guard_user_role
  BEFORE INSERT OR UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.flux_guard_user_role();

-- svr_own_insert and svr_own_update let an applicant write their own approval,
-- which would walk straight through the check above.
CREATE OR REPLACE FUNCTION public.flux_guard_staff_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_request_is_from_browser() OR public.flux_is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.verification_status := 'pending';
    NEW.identity_confirmed := false;
    NEW.resolved_at := NULL;
    NEW.owner_note := NULL;
  ELSE
    NEW.verification_status := OLD.verification_status;
    NEW.identity_confirmed := OLD.identity_confirmed;
    NEW.resolved_at := OLD.resolved_at;
    NEW.owner_note := OLD.owner_note;
    NEW.requested_role := OLD.requested_role;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS flux_guard_staff_verification ON public.staff_verification_requests;
CREATE TRIGGER flux_guard_staff_verification
  BEFORE INSERT OR UPDATE ON public.staff_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.flux_guard_staff_verification();

-- Teacher and counselor tables checked only that the row named the caller, so a
-- student account could create classes, enrol other students and push them
-- assignments without any teacher role. RESTRICTIVE policies add to the existing
-- ones without replacing them.
CREATE OR REPLACE FUNCTION public.flux_caller_is_educator()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.flux_is_platform_admin() OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('teacher', 'counselor', 'staff', 'admin')
  );
$function$;

REVOKE ALL ON FUNCTION public.flux_caller_is_educator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_caller_is_educator() TO authenticated, service_role;

DROP POLICY IF EXISTS flux_educator_only_insert ON public.teacher_classes;
CREATE POLICY flux_educator_only_insert ON public.teacher_classes
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.flux_caller_is_educator());

DROP POLICY IF EXISTS flux_educator_only_insert ON public.teacher_assignments;
CREATE POLICY flux_educator_only_insert ON public.teacher_assignments
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.flux_caller_is_educator());

DROP POLICY IF EXISTS flux_educator_only_insert ON public.teacher_announcements;
CREATE POLICY flux_educator_only_insert ON public.teacher_announcements
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.flux_caller_is_educator());

DROP POLICY IF EXISTS flux_educator_only_insert ON public.no_homework_days;
CREATE POLICY flux_educator_only_insert ON public.no_homework_days
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.flux_caller_is_educator());

-- A student may still enrol themselves; only an educator may enrol someone else.
DROP POLICY IF EXISTS flux_enrol_self_or_educator ON public.teacher_students;
CREATE POLICY flux_enrol_self_or_educator ON public.teacher_students
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() OR public.flux_caller_is_educator());

-- Without this a student could list themselves as a bookable school counselor.
DROP POLICY IF EXISTS flux_counselor_only_insert ON public.counselors;
CREATE POLICY flux_counselor_only_insert ON public.counselors
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.flux_is_platform_admin() OR public.flux_my_role() = 'counselor');

-- Sign-ups are confirmed automatically, so holding an address proves nothing.
-- counselors_claim_email and ensure_counselor_profile hand a counselor's profile
-- to whoever signs in with its address, and the owner's old address is unclaimed.
-- Refuse new accounts on those addresses. Existing accounts are not affected.
CREATE OR REPLACE FUNCTION public.flux_block_reserved_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF lower(trim(coalesce(NEW.email, ''))) = '' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE lower(trim(pa.email)) = lower(trim(NEW.email))
  ) OR EXISTS (
    SELECT 1 FROM public.counselors c
    WHERE lower(trim(c.email)) = lower(trim(NEW.email))
  ) THEN
    RAISE EXCEPTION 'This email address is reserved.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS flux_block_reserved_signup ON auth.users;
CREATE TRIGGER flux_block_reserved_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.flux_block_reserved_signup();

-- WITH CHECK (true) was OR'd with every other update policy on this table.
DROP POLICY IF EXISTS roles_platform_owner_update ON public.user_roles;
CREATE POLICY roles_platform_owner_update ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.flux_is_platform_admin())
  WITH CHECK (public.flux_is_platform_admin());

DROP POLICY IF EXISTS roles_update_own ON public.user_roles;
CREATE POLICY roles_update_own ON public.user_roles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
