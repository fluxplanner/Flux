-- Three gaps found on 2026-11-09.
--
-- 1. student_completions. The policy completions_student_own lets a student
--    write their own completion rows, which they need in order to hand work
--    in. It covers the whole row, so a student calling the API directly could
--    also set grade, feedback, teacher_note, rubric_scores and excused on
--    their own work, and the teacher's gradebook would show it as marked.
--    A trigger now keeps those columns the teacher's, the same way
--    flux_guard_appointment_student keeps a counselor's notes the counselor's.
--
-- 2. school_feed. feed_write_educators checks that the poster is an educator
--    but not that posted_by is the person posting, so one educator could post
--    under another's name. A restrictive policy pins posted_by to the caller.
--
-- 3. Four trigger functions were left executable by anon and authenticated.
--    A trigger function cannot be called through the API, so nothing was
--    reachable, but the grant had no purpose. Triggers still fire: that needs
--    no EXECUTE from the person whose write fires them.

CREATE OR REPLACE FUNCTION public.flux_guard_completion_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_request_is_from_browser()
     OR public.flux_is_platform_admin()
     OR EXISTS (
       SELECT 1 FROM public.teacher_assignments ta
       WHERE ta.id = NEW.assignment_id AND ta.teacher_id = auth.uid()
     ) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.grade := NULL;
    NEW.feedback := NULL;
    NEW.teacher_note := NULL;
    NEW.rubric_scores := NULL;
    NEW.excused := false;
    NEW.revision_requested := false;
    NEW.revision_due_date := NULL;
    NEW.parent_notified := false;
  ELSE
    NEW.assignment_id := OLD.assignment_id;
    NEW.student_id := OLD.student_id;
    NEW.grade := OLD.grade;
    NEW.feedback := OLD.feedback;
    NEW.teacher_note := OLD.teacher_note;
    NEW.rubric_scores := OLD.rubric_scores;
    NEW.excused := OLD.excused;
    NEW.revision_requested := OLD.revision_requested;
    NEW.revision_due_date := OLD.revision_due_date;
    NEW.parent_notified := OLD.parent_notified;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.flux_guard_completion_student() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS flux_guard_completion_student ON public.student_completions;
CREATE TRIGGER flux_guard_completion_student
  BEFORE INSERT OR UPDATE ON public.student_completions
  FOR EACH ROW EXECUTE FUNCTION public.flux_guard_completion_student();

DROP POLICY IF EXISTS flux_feed_real_author ON public.school_feed;
CREATE POLICY flux_feed_real_author ON public.school_feed
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (posted_by = auth.uid());

REVOKE ALL ON FUNCTION
  public.flux_log_ban_change(),
  public.flux_log_owner_mfa_change(),
  public.flux_log_platform_admin_change(),
  public.flux_log_user_role_change()
FROM PUBLIC, anon, authenticated;
