-- Leaving a class you joined by code.
--
-- Deleting such a class in the School planner removed it locally and then tried
-- `update teacher_students set active = false` as the student. RLS gives
-- students SELECT only on teacher_students (the write policy is for the
-- teacher), so for every real student that update matched 0 rows, returned no
-- error, and the enrolment stayed active. syncEnrolledTeacherClassesToPlanner
-- re-adds every active enrolment on load, so the class came back after each
-- refresh.
--
-- This does the one thing a student may do to their own enrolment: switch it
-- off. It only ever touches rows whose student_id is the caller, so it cannot
-- reach anyone else's enrolment or any teacher's class. Re-joining with the
-- code (flux_join_teacher_class) switches it back on as before.
create or replace function public.flux_leave_teacher_class(p_code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
  n integer := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if length(v_code) < 4 then
    return false;
  end if;

  update public.teacher_students
     set active = false
   where student_id = v_uid
     and upper(trim(class_code)) = v_code
     and active = true;
  get diagnostics n = row_count;

  delete from public.student_class_codes
   where student_id = v_uid
     and upper(trim(class_code)) = v_code;

  return n > 0;
end;
$$;

revoke all on function public.flux_leave_teacher_class(text) from public, anon;
grant execute on function public.flux_leave_teacher_class(text) to authenticated;
