-- Staff Office Hours: any staff member publishes weekly drop-in slots that
-- every signed-in student can read. Mirrors RLS shape of teacher_announcements
-- (owner-writes / student-reads-active) and slot shape of counselor_availability_slots.

CREATE TABLE IF NOT EXISTS public.staff_office_hours (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_name    TEXT,
  staff_role    TEXT DEFAULT 'staff' CHECK (staff_role IN ('teacher','counselor','admin','staff')),
  staff_subject TEXT,
  day_of_week   TEXT NOT NULL CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday')),
  start_time    TEXT NOT NULL,
  end_time      TEXT NOT NULL,
  location      TEXT,
  note          TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, day_of_week, start_time)
);

ALTER TABLE public.staff_office_hours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "soh_public_read" ON public.staff_office_hours;
CREATE POLICY "soh_public_read" ON public.staff_office_hours
  FOR SELECT TO authenticated USING (is_active = true);

DROP POLICY IF EXISTS "soh_owner_all" ON public.staff_office_hours;
CREATE POLICY "soh_owner_all" ON public.staff_office_hours
  FOR ALL TO authenticated
  USING (auth.uid() = staff_id)
  WITH CHECK (auth.uid() = staff_id);

CREATE INDEX IF NOT EXISTS idx_soh_active ON public.staff_office_hours (is_active);
CREATE INDEX IF NOT EXISTS idx_soh_staff  ON public.staff_office_hours (staff_id);
CREATE INDEX IF NOT EXISTS idx_soh_day    ON public.staff_office_hours (day_of_week);
