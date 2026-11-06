-- Security audit, 2026-11-06. Each section closes a hole reproduced against the
-- live schema in a rolled-back transaction.

-- 1. School is an authorization attribute, so an educator cannot pick their own.
-- A counselor could set user_roles.school to any school and read that school's
-- accommodation records. Dropping to student and coming back was the second route,
-- so a raise takes its school from the owner-approved request, never the browser.
-- Students may still choose a school: no student policy grants records by school.
CREATE OR REPLACE FUNCTION public.flux_guard_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_previous text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.role ELSE 'student' END;
  v_prev_school text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.school END;
  v_prev_slug text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.school_slug END;
  v_approved boolean := false;
  v_approved_school text;
BEGIN
  IF NOT public.flux_request_is_from_browser() OR public.flux_is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF NEW.role = 'student' THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS NOT DISTINCT FROM v_previous THEN
    NEW.school := v_prev_school;
    NEW.school_slug := v_prev_slug;
    RETURN NEW;
  END IF;

  SELECT true, nullif(btrim(svr.school), '')
    INTO v_approved, v_approved_school
    FROM public.staff_verification_requests svr
   WHERE svr.user_id = NEW.user_id
     AND svr.verification_status = 'approved'
     AND svr.requested_role = NEW.role
   ORDER BY svr.resolved_at DESC NULLS LAST
   LIMIT 1;

  IF coalesce(v_approved, false) THEN
    IF lower(coalesce(v_approved_school, '')) IS DISTINCT FROM lower(btrim(coalesce(v_prev_school, ''))) THEN
      NEW.school_slug := NULL;
    ELSE
      NEW.school_slug := v_prev_slug;
    END IF;
    NEW.school := v_approved_school;
    RETURN NEW;
  END IF;

  NEW.role := v_previous;
  IF v_previous <> 'student' THEN
    NEW.school := v_prev_school;
    NEW.school_slug := v_prev_slug;
  END IF;
  RETURN NEW;
END;
$function$;

-- An approved request fixes the school above, so the applicant cannot edit it later.
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
    IF OLD.verification_status IS DISTINCT FROM 'pending' THEN
      NEW.school := OLD.school;
    END IF;
    NEW.verification_status := OLD.verification_status;
    NEW.identity_confirmed := OLD.identity_confirmed;
    NEW.resolved_at := OLD.resolved_at;
    NEW.owner_note := OLD.owner_note;
    NEW.requested_role := OLD.requested_role;
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. A student could link themselves to any counselor, then read every appointment
-- that counselor had, including other students' reasons and counselor notes.
-- Booking only needs which slots are taken, so that is all this returns.
DROP POLICY IF EXISTS appts_student_counselor_slots ON public.counselor_appointments;

CREATE OR REPLACE FUNCTION public.flux_counselor_taken_slots(p_counselor_id uuid, p_from date, p_to date)
RETURNS TABLE(date date, time_slot text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT a.date, a.time_slot::text
    FROM public.counselor_appointments a
   WHERE auth.uid() IS NOT NULL
     AND a.counselor_id = p_counselor_id
     AND a.date BETWEEN p_from AND least(p_to, p_from + 60)
     AND a.status IS DISTINCT FROM 'cancelled';
$function$;
REVOKE ALL ON FUNCTION public.flux_counselor_taken_slots(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_counselor_taken_slots(uuid, date, date) TO authenticated, service_role;

-- appts_student_own let a student write the counselor's side of their own booking.
CREATE OR REPLACE FUNCTION public.flux_guard_appointment_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_request_is_from_browser()
     OR public.flux_is_platform_admin()
     OR EXISTS (SELECT 1 FROM public.counselors c WHERE c.id = NEW.counselor_id AND c.user_id = auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.counselor_notes := NULL;
    NEW.counselor_response := NULL;
    NEW.counselor_reply := NULL;
    NEW.meeting_link := NULL;
  ELSE
    NEW.counselor_id := OLD.counselor_id;
    NEW.student_id := OLD.student_id;
    NEW.counselor_notes := OLD.counselor_notes;
    NEW.counselor_response := OLD.counselor_response;
    NEW.counselor_reply := OLD.counselor_reply;
    NEW.meeting_link := OLD.meeting_link;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS flux_guard_appointment_student ON public.counselor_appointments;
CREATE TRIGGER flux_guard_appointment_student
  BEFORE INSERT OR UPDATE ON public.counselor_appointments
  FOR EACH ROW EXECUTE FUNCTION public.flux_guard_appointment_student();

-- 3. Parent invites: this policy accepted a claim with no code and let the claimer
-- choose the visibility tier. flux_parent_claim_invite is the only intended route.
DROP POLICY IF EXISTS flux_parent_links_parent_update_claim ON public.flux_parent_links;

-- 4. Direct messages: messages_own had no write check of its own, so anyone could
-- send a message naming another person as the sender.
DROP POLICY IF EXISTS flux_messages_real_sender ON public.flux_messages;
CREATE POLICY flux_messages_real_sender ON public.flux_messages
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.flux_threads t
       WHERE t.id = thread_id
         AND ((t.participant_1 = auth.uid() AND t.participant_2 = recipient_id)
           OR (t.participant_2 = auth.uid() AND t.participant_1 = recipient_id))
    )
  );

CREATE OR REPLACE FUNCTION public.flux_guard_message_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_request_is_from_browser() OR public.flux_is_platform_admin() THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS DISTINCT FROM OLD.recipient_id THEN
    RETURN OLD;
  END IF;
  OLD.read := NEW.read;
  OLD.read_at := NEW.read_at;
  RETURN OLD;
END;
$function$;
DROP TRIGGER IF EXISTS flux_guard_message_update ON public.flux_messages;
CREATE TRIGGER flux_guard_message_update
  BEFORE UPDATE ON public.flux_messages
  FOR EACH ROW EXECUTE FUNCTION public.flux_guard_message_update();

CREATE OR REPLACE FUNCTION public.flux_guard_thread_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.flux_request_is_from_browser() AND NOT public.flux_is_platform_admin() THEN
    NEW.participant_1 := OLD.participant_1;
    NEW.participant_2 := OLD.participant_2;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS flux_guard_thread_update ON public.flux_threads;
CREATE TRIGGER flux_guard_thread_update
  BEFORE UPDATE ON public.flux_threads
  FOR EACH ROW EXECUTE FUNCTION public.flux_guard_thread_update();

-- 5. A school admin's rights stop at their school. These policies only asked whether
-- the caller was an admin of any school. One could also make themselves a district
-- admin, or change another school's feature flags and emergency broadcast.
CREATE OR REPLACE FUNCTION public.flux_user_in_school(p_user uuid, p_school text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
     WHERE ur.user_id = p_user
       AND nullif(btrim(ur.school), '') IS NOT NULL
       AND lower(btrim(ur.school)) = lower(btrim(p_school))
  );
$function$;
REVOKE ALL ON FUNCTION public.flux_user_in_school(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_user_in_school(uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS roles_select_as_admin ON public.user_roles;
CREATE POLICY roles_select_as_admin ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    public.flux_is_platform_admin()
    OR (public.flux_my_role() = 'admin' AND public.flux_user_in_school(auth.uid(), school))
  );

DROP POLICY IF EXISTS classes_admin_read ON public.teacher_classes;
CREATE POLICY classes_admin_read ON public.teacher_classes
  FOR SELECT TO authenticated
  USING (
    public.flux_is_platform_admin()
    OR (public.flux_my_role() = 'admin' AND public.flux_user_in_school(teacher_id, public.flux_my_school()))
  );

DROP POLICY IF EXISTS tsn_admin_read ON public.teacher_student_notes;
CREATE POLICY tsn_admin_read ON public.teacher_student_notes
  FOR SELECT TO authenticated
  USING (
    shared_with_admin = true
    AND (
      public.flux_is_platform_admin()
      OR (public.flux_my_role() = 'admin' AND public.flux_user_in_school(student_id, public.flux_my_school()))
    )
  );

DROP POLICY IF EXISTS fda_admin_manage ON public.flux_district_admins;
CREATE POLICY fda_admin_manage ON public.flux_district_admins
  FOR ALL TO authenticated
  USING (public.flux_is_platform_admin())
  WITH CHECK (public.flux_is_platform_admin());

DROP POLICY IF EXISTS flux_school_flags_admin ON public.flux_school_feature_flags;
CREATE POLICY flux_school_flags_admin ON public.flux_school_feature_flags
  FOR ALL TO authenticated
  USING (
    public.flux_is_platform_admin()
    OR (public.flux_my_role() = 'admin' AND public.flux_user_in_school(auth.uid(), school_key))
  )
  WITH CHECK (
    public.flux_is_platform_admin()
    OR (public.flux_my_role() = 'admin' AND public.flux_user_in_school(auth.uid(), school_key))
  );

DROP POLICY IF EXISTS fsb_admin_write ON public.flux_school_broadcast;
CREATE POLICY fsb_admin_write ON public.flux_school_broadcast
  FOR ALL TO authenticated
  USING (
    public.flux_is_platform_admin()
    OR (public.flux_my_role() IN ('admin', 'staff') AND EXISTS (
      SELECT 1 FROM public.flux_schools fs
       WHERE fs.slug = flux_school_broadcast.school_slug
         AND public.flux_user_in_school(auth.uid(), fs.name)
    ))
  )
  WITH CHECK (
    public.flux_is_platform_admin()
    OR (public.flux_my_role() IN ('admin', 'staff') AND EXISTS (
      SELECT 1 FROM public.flux_schools fs
       WHERE fs.slug = flux_school_broadcast.school_slug
         AND public.flux_user_in_school(auth.uid(), fs.name)
    ))
  );

-- Telemetry is per user across every school, and no client screen reads it directly.
DROP POLICY IF EXISTS flux_ai_agent_runs_admin_read ON public.flux_ai_agent_runs;
CREATE POLICY flux_ai_agent_runs_admin_read ON public.flux_ai_agent_runs
  FOR SELECT TO authenticated USING (public.flux_is_platform_admin());
DROP POLICY IF EXISTS flux_processor_jobs_admin_read ON public.flux_processor_jobs;
CREATE POLICY flux_processor_jobs_admin_read ON public.flux_processor_jobs
  FOR SELECT TO authenticated USING (public.flux_is_platform_admin());
DROP POLICY IF EXISTS flux_product_events_admin_read ON public.flux_product_events;
CREATE POLICY flux_product_events_admin_read ON public.flux_product_events
  FOR SELECT TO authenticated
  USING (
    public.flux_is_platform_admin()
    OR (public.flux_my_role() = 'admin' AND public.flux_user_in_school(auth.uid(), school_key))
  );

-- 6. Accommodation records must name a student who belongs to that school.
DROP POLICY IF EXISTS flux_accom_student_in_school_ins ON public.staff_student_accommodations;
CREATE POLICY flux_accom_student_in_school_ins ON public.staff_student_accommodations
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.flux_user_in_school(student_id, school));
DROP POLICY IF EXISTS flux_accom_student_in_school_upd ON public.staff_student_accommodations;
CREATE POLICY flux_accom_student_in_school_upd ON public.staff_student_accommodations
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true) WITH CHECK (public.flux_user_in_school(student_id, school));
DROP POLICY IF EXISTS flux_accom_student_in_school_ins ON public.flux_student_accommodations;
CREATE POLICY flux_accom_student_in_school_ins ON public.flux_student_accommodations
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.flux_user_in_school(student_id, school));
DROP POLICY IF EXISTS flux_accom_student_in_school_upd ON public.flux_student_accommodations;
CREATE POLICY flux_accom_student_in_school_upd ON public.flux_student_accommodations
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (true) WITH CHECK (public.flux_user_in_school(student_id, school));

-- 7. A teacher could post assignments and announcements into another teacher's class,
-- because only the row's teacher_id was checked. Students would see them as real.
CREATE OR REPLACE FUNCTION public.flux_owns_class(p_class_id uuid, p_class_code text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.flux_is_platform_admin() OR (
    (p_class_id IS NULL OR EXISTS (
      SELECT 1 FROM public.teacher_classes tc WHERE tc.id = p_class_id AND tc.teacher_id = auth.uid()))
    AND (p_class_code IS NULL OR EXISTS (
      SELECT 1 FROM public.teacher_classes tc WHERE tc.class_code = p_class_code AND tc.teacher_id = auth.uid()))
  );
$function$;
REVOKE ALL ON FUNCTION public.flux_owns_class(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_owns_class(uuid, text) TO authenticated, service_role;

DROP POLICY IF EXISTS flux_own_class_ins ON public.teacher_assignments;
CREATE POLICY flux_own_class_ins ON public.teacher_assignments
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.flux_owns_class(class_id, class_code));
DROP POLICY IF EXISTS flux_own_class_upd ON public.teacher_assignments;
CREATE POLICY flux_own_class_upd ON public.teacher_assignments
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (public.flux_owns_class(class_id, class_code));
DROP POLICY IF EXISTS flux_own_class_ins ON public.teacher_announcements;
CREATE POLICY flux_own_class_ins ON public.teacher_announcements
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.flux_owns_class(class_id, NULL));
DROP POLICY IF EXISTS flux_own_class_upd ON public.teacher_announcements;
CREATE POLICY flux_own_class_upd ON public.teacher_announcements
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (public.flux_owns_class(class_id, NULL));
DROP POLICY IF EXISTS flux_own_class_ins ON public.no_homework_days;
CREATE POLICY flux_own_class_ins ON public.no_homework_days
  AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.flux_owns_class(class_id, NULL));
DROP POLICY IF EXISTS flux_own_class_upd ON public.no_homework_days;
CREATE POLICY flux_own_class_upd ON public.no_homework_days
  AS RESTRICTIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (public.flux_owns_class(class_id, NULL));

-- 8. The password-help form takes anonymous writes and had no limit at all.
CREATE OR REPLACE FUNCTION public.flux_password_help_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.flux_request_is_from_browser() AND (
    (SELECT count(*) FROM public.flux_password_help h
      WHERE lower(btrim(h.username)) = lower(btrim(NEW.username))
        AND h.created_at > now() - interval '1 hour') >= 3
    OR (SELECT count(*) FROM public.flux_password_help h
      WHERE h.created_at > now() - interval '1 hour') >= 40
  ) THEN
    RAISE EXCEPTION 'Too many requests. Please try again later.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS flux_password_help_rate_limit ON public.flux_password_help;
CREATE TRIGGER flux_password_help_rate_limit
  BEFORE INSERT ON public.flux_password_help
  FOR EACH ROW EXECUTE FUNCTION public.flux_password_help_rate_limit();

-- 9. Do not hand database error text back to the browser.
CREATE OR REPLACE FUNCTION public.join_flux_school(p_join_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  s RECORD;
  uid UUID;
  existing_role TEXT;
  norm_code TEXT;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  norm_code := public.normalize_flux_school_code(p_join_code);
  IF norm_code = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  SELECT id, name, short_name, join_code INTO s
    FROM public.flux_schools
   WHERE active = true AND public.normalize_flux_school_code(join_code) = norm_code
   LIMIT 1;
  -- Legacy alias: accept IA-EAST when DB still has IAE-EAST
  IF s.id IS NULL AND norm_code IN ('IA-EAST', 'IAE-EAST') THEN
    SELECT id, name, short_name, join_code INTO s
      FROM public.flux_schools
     WHERE active = true AND slug = 'iae'
     LIMIT 1;
  END IF;
  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;
  SELECT role INTO existing_role FROM public.user_roles WHERE user_id = uid;
  IF existing_role IS NULL THEN
    INSERT INTO public.user_roles (user_id, role, school, updated_at)
    VALUES (uid, 'student', s.name, NOW());
  ELSE
    UPDATE public.user_roles SET school = s.name, updated_at = NOW() WHERE user_id = uid;
  END IF;
  RETURN jsonb_build_object('ok', true, 'school', s.name, 'short_name', s.short_name, 'join_code', s.join_code);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'join_flux_school: %', SQLERRM;
  RETURN jsonb_build_object('ok', false, 'error', 'server_error');
END;
$function$;

-- 10. Least privilege. Row rules already stop these, so this is a second layer that
-- holds if one table's rules are ever switched off by mistake. Signed-out read grants
-- stay for now: row rules hide the rows, and removing them needs a wider client test.
REVOKE EXECUTE ON FUNCTION public.flux_block_reserved_signup() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flux_device_ban_cascade() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flux_guard_staff_verification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flux_guard_user_role() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flux_log_public_content() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flux_message_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flux_guard_appointment_student() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flux_guard_message_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flux_guard_thread_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flux_password_help_rate_limit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flux_device_checkin(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_device_checkin(text) TO authenticated, service_role;
-- flux_check_request stays callable by anon: it runs before every API request.
-- flux_get_sub_plan stays callable by anon: substitutes open it by code, signed out.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM anon;
GRANT INSERT ON public.flux_password_help TO anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLES FROM authenticated;
