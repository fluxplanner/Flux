-- ════════════════════════════════════════════════════════════════════════
-- FLUX · Staff Office Hours  (May 2026)
-- ------------------------------------------------------------------------
-- Any staff member (teacher / counselor / admin / staff) publishes weekly
-- office / help / prep hours. Every signed-in student can read the active
-- ones. Mirrors the RLS shape of public.teacher_announcements (staff writes
-- own rows; students read where active) and the structured-slot shape of
-- public.counselor_availability_slots.
--
-- Safe to run multiple times (IF NOT EXISTS + DROP POLICY IF EXISTS).
-- Paste into the Supabase SQL editor (same project as PASTE-INTO-SUPABASE.sql).
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.staff_office_hours (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Denormalized so the student view needs no join (same approach the class
  -- lookup uses with teacher_display_name).
  staff_name    TEXT,
  staff_role    TEXT DEFAULT 'staff' CHECK (staff_role IN ('teacher','counselor','admin','staff')),
  staff_subject TEXT,
  day_of_week   TEXT NOT NULL CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday')),
  start_time    TEXT NOT NULL,            -- 'HH:MM' 24h
  end_time      TEXT NOT NULL,            -- 'HH:MM' 24h
  location      TEXT,                     -- e.g. 'Room 204', 'Counselor Office', 'Library'
  note          TEXT,                     -- e.g. 'Drop-in, no appointment needed'
  is_active     BOOLEAN NOT NULL DEFAULT true,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (staff_id, day_of_week, start_time)
);

ALTER TABLE public.staff_office_hours ENABLE ROW LEVEL SECURITY;

-- Students (any authenticated user) read active office hours.
DROP POLICY IF EXISTS "soh_public_read" ON public.staff_office_hours;
CREATE POLICY "soh_public_read" ON public.staff_office_hours
  FOR SELECT TO authenticated USING (is_active = true);

-- Staff manage only their own rows.
DROP POLICY IF EXISTS "soh_owner_all" ON public.staff_office_hours;
CREATE POLICY "soh_owner_all" ON public.staff_office_hours
  FOR ALL TO authenticated
  USING (auth.uid() = staff_id)
  WITH CHECK (auth.uid() = staff_id);

CREATE INDEX IF NOT EXISTS idx_soh_active     ON public.staff_office_hours (is_active);
CREATE INDEX IF NOT EXISTS idx_soh_staff      ON public.staff_office_hours (staff_id);
CREATE INDEX IF NOT EXISTS idx_soh_day        ON public.staff_office_hours (day_of_week);
