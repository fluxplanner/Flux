-- Office hour bookings: students claim a weekly staff_office_hours slot for a
-- specific week. One booking per slot per week (race-safe via UNIQUE).
--
-- Privacy model:
--   • A student sees only their own bookings.
--   • The slot's owner (staff) sees bookings on their slots.
--   • Other students learn ONLY that a slot is taken, via get_booked_slots()
--     (SECURITY DEFINER, returns slot ids for one week — no identities), so
--     the client can hide taken slots from everyone except the booker.

CREATE TABLE IF NOT EXISTS public.office_hour_bookings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id      UUID NOT NULL REFERENCES public.staff_office_hours(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_name TEXT,
  week_start   DATE NOT NULL, -- Monday of the booked week
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slot_id, week_start)
);

ALTER TABLE public.office_hour_bookings ENABLE ROW LEVEL SECURITY;

-- Students read their own bookings; staff read bookings on their own slots.
DROP POLICY IF EXISTS "ohb_read_own_or_owner" ON public.office_hour_bookings;
CREATE POLICY "ohb_read_own_or_owner" ON public.office_hour_bookings
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.staff_office_hours s
      WHERE s.id = slot_id AND s.staff_id = auth.uid()
    )
  );

-- Students book for themselves only, on active slots.
DROP POLICY IF EXISTS "ohb_insert_self" ON public.office_hour_bookings;
CREATE POLICY "ohb_insert_self" ON public.office_hour_bookings
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.staff_office_hours s
      WHERE s.id = slot_id AND s.is_active = true
    )
  );

-- Students cancel their own bookings; staff can clear bookings on their slots.
DROP POLICY IF EXISTS "ohb_delete_own_or_owner" ON public.office_hour_bookings;
CREATE POLICY "ohb_delete_own_or_owner" ON public.office_hour_bookings
  FOR DELETE TO authenticated
  USING (
    student_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.staff_office_hours s
      WHERE s.id = slot_id AND s.staff_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_ohb_slot ON public.office_hour_bookings (slot_id);
CREATE INDEX IF NOT EXISTS idx_ohb_student ON public.office_hour_bookings (student_id);
CREATE INDEX IF NOT EXISTS idx_ohb_week ON public.office_hour_bookings (week_start);

-- Which slots are taken in a given week — ids only, no identities. Lets the
-- client hide booked slots from students other than the booker.
CREATE OR REPLACE FUNCTION public.get_booked_slots(p_week_start DATE)
RETURNS TABLE (slot_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT b.slot_id FROM public.office_hour_bookings b WHERE b.week_start = p_week_start;
$$;

REVOKE ALL ON FUNCTION public.get_booked_slots(DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booked_slots(DATE) TO authenticated;
