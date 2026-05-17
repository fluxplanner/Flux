-- ════════════════════════════════════════════════════════════════════
-- FLUX PLANNER — Educator platform expansion (join requests, admin,
-- school calendar/announcements, counselor slots, teacher notes, etc.)
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1. Class join requests (teacher approval flow)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.class_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','withdrawn')),
  student_note TEXT,
  teacher_note TEXT,
  period TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(class_id, student_id)
);

ALTER TABLE public.class_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cjr_student_select" ON public.class_join_requests;
CREATE POLICY "cjr_student_select" ON public.class_join_requests
  FOR SELECT TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "cjr_teacher_select" ON public.class_join_requests;
CREATE POLICY "cjr_teacher_select" ON public.class_join_requests
  FOR SELECT TO authenticated USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "cjr_student_insert" ON public.class_join_requests;
CREATE POLICY "cjr_student_insert" ON public.class_join_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = student_id
    AND teacher_id = (SELECT tc.teacher_id FROM public.teacher_classes tc WHERE tc.id = class_id)
  );

DROP POLICY IF EXISTS "cjr_student_update" ON public.class_join_requests;
CREATE POLICY "cjr_student_update" ON public.class_join_requests
  FOR UPDATE TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "cjr_teacher_update" ON public.class_join_requests;
CREATE POLICY "cjr_teacher_update" ON public.class_join_requests
  FOR UPDATE TO authenticated USING (auth.uid() = teacher_id);

CREATE INDEX IF NOT EXISTS idx_cjr_student ON public.class_join_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_cjr_teacher ON public.class_join_requests(teacher_id);
CREATE INDEX IF NOT EXISTS idx_cjr_status ON public.class_join_requests(status);

-- ──────────────────────────────────────────────────────────────────
-- 2. Counselor availability slots
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.counselor_availability_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id UUID NOT NULL REFERENCES public.counselors(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday')),
  time_slot TEXT NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT true,
  max_bookings INTEGER NOT NULL DEFAULT 1,
  slot_duration_minutes INTEGER NOT NULL DEFAULT 30,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(counselor_id, day_of_week, time_slot)
);

ALTER TABLE public.counselor_availability_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cas_public_read" ON public.counselor_availability_slots;
CREATE POLICY "cas_public_read" ON public.counselor_availability_slots
  FOR SELECT TO authenticated USING (is_available = true);

DROP POLICY IF EXISTS "cas_counselor_all" ON public.counselor_availability_slots;
CREATE POLICY "cas_counselor_all" ON public.counselor_availability_slots
  FOR ALL TO authenticated
  USING (counselor_id IN (SELECT id FROM public.counselors WHERE user_id = auth.uid()))
  WITH CHECK (counselor_id IN (SELECT id FROM public.counselors WHERE user_id = auth.uid()));

-- Seed from counselors.availability JSON (best-effort)
INSERT INTO public.counselor_availability_slots (counselor_id, day_of_week, time_slot, is_available)
SELECT c.id,
       lower(btrim(day.key::text, '"')),
       btrim(slot.value::text, '"'),
       true
FROM public.counselors c
CROSS JOIN LATERAL jsonb_each(c.availability) AS day(key, slots)
CROSS JOIN LATERAL jsonb_array_elements_text(day.slots) AS slot(value)
WHERE c.availability IS NOT NULL
  AND jsonb_typeof(c.availability) = 'object'
ON CONFLICT (counselor_id, day_of_week, time_slot) DO NOTHING;

-- ──────────────────────────────────────────────────────────────────
-- 3. Counselor appointments — extra columns
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.counselor_appointments
  ADD COLUMN IF NOT EXISTS student_requested_message TEXT,
  ADD COLUMN IF NOT EXISTS counselor_response TEXT,
  ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_pattern TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'Counselor Office',
  ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN NOT NULL DEFAULT false;

-- ──────────────────────────────────────────────────────────────────
-- 4. Admin profiles & meetings
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT DEFAULT 'Principal',
  school_name TEXT,
  school_address TEXT,
  school_phone TEXT,
  school_colors JSONB DEFAULT '{"primary":"#00bfff","secondary":"#7c5cff"}'::jsonb,
  school_logo_url TEXT,
  permissions JSONB DEFAULT '{"can_view_all_data":true,"can_message_all":true,"can_manage_users":true,"can_post_announcements":true,"can_manage_schedule":true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_own" ON public.admin_profiles;
CREATE POLICY "admin_read_own" ON public.admin_profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_insert_own" ON public.admin_profiles;
CREATE POLICY "admin_insert_own" ON public.admin_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_update_own" ON public.admin_profiles;
CREATE POLICY "admin_update_own" ON public.admin_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.admin_meeting_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL CHECK (day_of_week IN ('monday','tuesday','wednesday','thursday','friday')),
  time_slot TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  slot_type TEXT NOT NULL DEFAULT 'open' CHECK (slot_type IN ('open','by_request','blocked')),
  notes TEXT,
  UNIQUE(admin_id, day_of_week, time_slot)
);

ALTER TABLE public.admin_meeting_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ams_admin_all" ON public.admin_meeting_slots;
CREATE POLICY "ams_admin_all" ON public.admin_meeting_slots
  FOR ALL TO authenticated
  USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

DROP POLICY IF EXISTS "ams_student_read" ON public.admin_meeting_slots;
CREATE POLICY "ams_student_read" ON public.admin_meeting_slots
  FOR SELECT TO authenticated USING (slot_type IN ('open','by_request'));

CREATE TABLE IF NOT EXISTS public.admin_meeting_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_slot TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 15,
  subject TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','completed','cancelled')),
  admin_response TEXT,
  location TEXT DEFAULT 'Principal Office',
  is_urgent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(admin_id, student_id, date, time_slot)
);

ALTER TABLE public.admin_meeting_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "amr_student_own" ON public.admin_meeting_requests;
CREATE POLICY "amr_student_own" ON public.admin_meeting_requests
  FOR ALL TO authenticated USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "amr_admin_all" ON public.admin_meeting_requests;
CREATE POLICY "amr_admin_all" ON public.admin_meeting_requests
  FOR ALL TO authenticated USING (auth.uid() = admin_id)
  WITH CHECK (auth.uid() = admin_id);

CREATE INDEX IF NOT EXISTS idx_amr_admin ON public.admin_meeting_requests(admin_id);
CREATE INDEX IF NOT EXISTS idx_amr_student ON public.admin_meeting_requests(student_id);

-- ──────────────────────────────────────────────────────────────────
-- 5. School-wide announcements
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal','important','urgent','emergency')),
  target_roles TEXT[] DEFAULT ARRAY['student','teacher','counselor','staff']::text[],
  target_classes UUID[],
  expires_at TIMESTAMPTZ,
  pinned BOOLEAN NOT NULL DEFAULT false,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.school_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sa_read_all" ON public.school_announcements;
CREATE POLICY "sa_read_all" ON public.school_announcements
  FOR SELECT TO authenticated USING (expires_at IS NULL OR expires_at > now());

DROP POLICY IF EXISTS "sa_insert_admin" ON public.school_announcements;
CREATE POLICY "sa_insert_admin" ON public.school_announcements
  FOR INSERT TO authenticated
  WITH CHECK (
    posted_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','staff')
    )
  );

DROP POLICY IF EXISTS "sa_update_own" ON public.school_announcements;
CREATE POLICY "sa_update_own" ON public.school_announcements
  FOR UPDATE TO authenticated USING (posted_by = auth.uid());

DROP POLICY IF EXISTS "sa_delete_own" ON public.school_announcements;
CREATE POLICY "sa_delete_own" ON public.school_announcements
  FOR DELETE TO authenticated USING (posted_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_sa_date ON public.school_announcements(created_at DESC);

-- ──────────────────────────────────────────────────────────────────
-- 6. School calendar events
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  event_type TEXT NOT NULL DEFAULT 'general'
    CHECK (event_type IN ('general','holiday','exam','no_school','early_release','activity','sports','deadline')),
  affects_roles TEXT[] DEFAULT ARRAY['student','teacher','counselor','staff']::text[],
  is_no_homework_day BOOLEAN NOT NULL DEFAULT false,
  color TEXT DEFAULT '#00bfff',
  all_day BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.school_calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sce_read_all" ON public.school_calendar_events;
CREATE POLICY "sce_read_all" ON public.school_calendar_events
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "sce_insert_staff" ON public.school_calendar_events;
CREATE POLICY "sce_insert_staff" ON public.school_calendar_events
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','staff','teacher')
    )
  );

DROP POLICY IF EXISTS "sce_update_own" ON public.school_calendar_events;
CREATE POLICY "sce_update_own" ON public.school_calendar_events
  FOR UPDATE TO authenticated USING (created_by = auth.uid());

DROP POLICY IF EXISTS "sce_delete_own" ON public.school_calendar_events;
CREATE POLICY "sce_delete_own" ON public.school_calendar_events
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE INDEX IF NOT EXISTS idx_sce_date ON public.school_calendar_events(event_date);

-- ──────────────────────────────────────────────────────────────────
-- 7. Student completions — gradebook columns + teacher INSERT
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.student_completions
  ADD COLUMN IF NOT EXISTS rubric_scores JSONB,
  ADD COLUMN IF NOT EXISTS time_spent_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS attempts INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_late BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS excused BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revision_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revision_due_date DATE,
  ADD COLUMN IF NOT EXISTS parent_notified BOOLEAN NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "completions_teacher_insert" ON public.student_completions;
CREATE POLICY "completions_teacher_insert" ON public.student_completions
  FOR INSERT TO authenticated
  WITH CHECK (
    assignment_id IN (
      SELECT ta.id FROM public.teacher_assignments ta WHERE ta.teacher_id = auth.uid()
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- 8. Teacher–student notes
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_student_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  is_concern BOOLEAN NOT NULL DEFAULT false,
  is_private BOOLEAN NOT NULL DEFAULT true,
  shared_with_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teacher_student_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tsn_teacher_own" ON public.teacher_student_notes;
CREATE POLICY "tsn_teacher_own" ON public.teacher_student_notes
  FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "tsn_admin_read" ON public.teacher_student_notes;
CREATE POLICY "tsn_admin_read" ON public.teacher_student_notes
  FOR SELECT TO authenticated
  USING (
    shared_with_admin = true
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

-- ──────────────────────────────────────────────────────────────────
-- 9. Realtime (best-effort)
-- ──────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.class_join_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.school_announcements; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_meeting_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
