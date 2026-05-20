-- Teacher class bell schedule — period/hour + times for student planner auto-fill.

ALTER TABLE public.teacher_classes
  ADD COLUMN IF NOT EXISTS room TEXT,
  ADD COLUMN IF NOT EXISTS time_start TEXT,
  ADD COLUMN IF NOT EXISTS time_end TEXT,
  ADD COLUMN IF NOT EXISTS days TEXT;

COMMENT ON COLUMN public.teacher_classes.period IS 'Period or hour number (e.g. 3, A4, B4)';
COMMENT ON COLUMN public.teacher_classes.time_start IS 'Class start time HH:MM (local bell schedule)';
COMMENT ON COLUMN public.teacher_classes.time_end IS 'Class end time HH:MM';
COMMENT ON COLUMN public.teacher_classes.days IS 'A Day, B Day, Mon-Fri, etc.';

-- Include schedule in code lookup for join preview.
DROP FUNCTION IF EXISTS public.flux_lookup_class_by_code(TEXT);

CREATE OR REPLACE FUNCTION public.flux_lookup_class_by_code(p_code TEXT)
RETURNS TABLE (
  id          UUID,
  class_name  TEXT,
  teacher_id  UUID,
  subject     TEXT,
  period      TEXT,
  room        TEXT,
  time_start  TEXT,
  time_end    TEXT,
  days        TEXT,
  active      BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, class_name, teacher_id, subject, period, room, time_start, time_end, days, active
  FROM public.teacher_classes
  WHERE class_code = p_code
    AND active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.flux_lookup_class_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_lookup_class_by_code(TEXT) TO authenticated;
