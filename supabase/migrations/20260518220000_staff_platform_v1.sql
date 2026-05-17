-- Staff platform v1: verification, directory, personal JSON store, feed, adult tools,
-- counselor appointment slot constraint cleanup (partial unique), owner RLS for approvals.

-- ── 1. staff_verification_requests ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requested_role TEXT NOT NULL CHECK (requested_role IN ('teacher','counselor','staff','admin')),
  requested_name TEXT NOT NULL,
  school TEXT,
  department TEXT,
  subject TEXT,
  personal_gmail TEXT,
  school_email TEXT,
  verification_status TEXT DEFAULT 'pending'
    CHECK (verification_status IN ('pending','approved','rejected','needs_info')),
  owner_note TEXT,
  student_note TEXT,
  identity_confirmed BOOLEAN DEFAULT false,
  gmail_linked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  UNIQUE(user_id)
);

ALTER TABLE public.staff_verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "svr_own_read" ON public.staff_verification_requests;
CREATE POLICY "svr_own_read" ON public.staff_verification_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "svr_own_insert" ON public.staff_verification_requests;
CREATE POLICY "svr_own_insert" ON public.staff_verification_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "svr_own_update" ON public.staff_verification_requests;
CREATE POLICY "svr_own_update" ON public.staff_verification_requests
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Platform owner (same account as app OWNER_EMAIL) — full queue access
DROP POLICY IF EXISTS "svr_owner_select" ON public.staff_verification_requests;
CREATE POLICY "svr_owner_select" ON public.staff_verification_requests
  FOR SELECT TO authenticated
  USING (lower(trim(coalesce((auth.jwt() ->> 'email')::text, ''))) = 'azfermohammed21@gmail.com');

DROP POLICY IF EXISTS "svr_owner_update" ON public.staff_verification_requests;
CREATE POLICY "svr_owner_update" ON public.staff_verification_requests
  FOR UPDATE TO authenticated
  USING (lower(trim(coalesce((auth.jwt() ->> 'email')::text, ''))) = 'azfermohammed21@gmail.com')
  WITH CHECK (true);

-- ── 2. staff_directory ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_directory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher','counselor','staff','admin')),
  department TEXT,
  subject TEXT,
  school_email TEXT,
  room_number TEXT,
  is_claimed BOOLEAN DEFAULT false,
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.staff_directory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sdir_public_read" ON public.staff_directory;
CREATE POLICY "sdir_public_read" ON public.staff_directory
  FOR SELECT TO authenticated USING (active = true);

DROP POLICY IF EXISTS "sdir_claim_update" ON public.staff_directory;
CREATE POLICY "sdir_claim_update" ON public.staff_directory
  FOR UPDATE TO authenticated
  USING (active = true AND is_claimed = false)
  WITH CHECK (claimed_by = auth.uid() AND is_claimed = true);

INSERT INTO public.staff_directory (full_name, role, department, subject, school_email)
SELECT 'Mrs. Bernstein', 'counselor', 'Counseling', NULL, 'bernstein@school.edu'
WHERE NOT EXISTS (SELECT 1 FROM public.staff_directory sd WHERE lower(trim(coalesce(sd.school_email,''))) = 'bernstein@school.edu');

INSERT INTO public.staff_directory (full_name, role, department, subject, school_email)
SELECT 'Mrs. Phelps', 'counselor', 'Counseling', NULL, 'phelps@school.edu'
WHERE NOT EXISTS (SELECT 1 FROM public.staff_directory sd WHERE lower(trim(coalesce(sd.school_email,''))) = 'phelps@school.edu');

-- ── 3. staff_personal_data ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_personal_data (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tasks JSONB DEFAULT '[]',
  meetings JSONB DEFAULT '[]',
  professional_goals JSONB DEFAULT '[]',
  wellbeing_log JSONB DEFAULT '[]',
  meeting_notes JSONB DEFAULT '[]',
  professional_dev JSONB DEFAULT '[]',
  resources JSONB DEFAULT '[]',
  contacts JSONB DEFAULT '[]',
  calendar_events JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.staff_personal_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spd_own" ON public.staff_personal_data;
CREATE POLICY "spd_own" ON public.staff_personal_data
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 4. Counselor appointments — slot uniqueness (excludes cancelled) ──
DO $$ BEGIN
  ALTER TABLE public.counselor_appointments
    DROP CONSTRAINT IF EXISTS counselor_appointments_counselor_id_date_time_slot_key;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE public.counselor_appointments
  ADD COLUMN IF NOT EXISTS student_message TEXT,
  ADD COLUMN IF NOT EXISTS counselor_reply TEXT,
  ADD COLUMN IF NOT EXISTS meeting_type TEXT DEFAULT 'in_person',
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS follow_up_needed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_walk_in BOOLEAN DEFAULT false;

DO $$ BEGIN
  ALTER TABLE public.counselor_appointments
    ADD CONSTRAINT counselor_appointments_meeting_type_chk
    CHECK (meeting_type IS NULL OR meeting_type IN ('in_person','virtual','phone'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DROP INDEX IF EXISTS idx_appt_unique_slot;
CREATE UNIQUE INDEX IF NOT EXISTS idx_appt_unique_slot
  ON public.counselor_appointments(counselor_id, date, time_slot)
  WHERE status IS DISTINCT FROM 'cancelled';

-- ── 5. school_feed ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.school_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  posted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_type TEXT NOT NULL CHECK (post_type IN (
    'announcement','achievement','reminder','resource',
    'no_homework','event','shoutout','poll'
  )),
  title TEXT NOT NULL,
  body TEXT,
  target_class_ids UUID[],
  target_roles TEXT[] DEFAULT ARRAY['student']::text[],
  media_url TEXT,
  likes_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT false,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.school_feed ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_read_all" ON public.school_feed;
CREATE POLICY "feed_read_all" ON public.school_feed
  FOR SELECT TO authenticated USING (expires_at IS NULL OR expires_at > NOW());

DROP POLICY IF EXISTS "feed_write_educators" ON public.school_feed;
CREATE POLICY "feed_write_educators" ON public.school_feed
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role IN ('teacher','counselor','staff','admin')
  ));

-- Owner can moderate (delete) — optional pin updates
DROP POLICY IF EXISTS "feed_owner_delete" ON public.school_feed;
CREATE POLICY "feed_owner_delete" ON public.school_feed
  FOR DELETE TO authenticated
  USING (lower(trim(coalesce((auth.jwt() ->> 'email')::text, ''))) = 'azfermohammed21@gmail.com');

-- ── 6. meeting_notes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meeting_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  meeting_date DATE NOT NULL DEFAULT CURRENT_DATE,
  attendees TEXT[],
  location TEXT,
  body TEXT,
  action_items JSONB DEFAULT '[]'::jsonb,
  tags TEXT[],
  is_private BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.meeting_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mn_own" ON public.meeting_notes;
CREATE POLICY "mn_own" ON public.meeting_notes
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 7. professional_development ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.professional_development (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  provider TEXT,
  pd_type TEXT DEFAULT 'course'
    CHECK (pd_type IN ('course','workshop','conference','certification','book','webinar','other')),
  hours NUMERIC(6,2) DEFAULT 0,
  status TEXT DEFAULT 'planned'
    CHECK (status IN ('planned','in_progress','completed','cancelled')),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  certificate_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.professional_development ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pd_own" ON public.professional_development;
CREATE POLICY "pd_own" ON public.professional_development
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── 8. parent_contacts ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parent_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  parent_name TEXT,
  contact_method TEXT DEFAULT 'email'
    CHECK (contact_method IN ('email','phone','in_person','note','conference')),
  contact_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subject TEXT NOT NULL,
  summary TEXT,
  outcome TEXT,
  follow_up_needed BOOLEAN DEFAULT false,
  follow_up_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.parent_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pc_teacher_own" ON public.parent_contacts;
CREATE POLICY "pc_teacher_own" ON public.parent_contacts
  FOR ALL TO authenticated USING (auth.uid() = teacher_id) WITH CHECK (auth.uid() = teacher_id);

-- ── 9. Owner may update any user_roles row (approve staff) ─────────
DROP POLICY IF EXISTS "roles_platform_owner_update" ON public.user_roles;
CREATE POLICY "roles_platform_owner_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (lower(trim(coalesce((auth.jwt() ->> 'email')::text, ''))) = 'azfermohammed21@gmail.com')
  WITH CHECK (true);

-- ── 10. Realtime (ignore if already member) ───────────────────────
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.staff_verification_requests;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.school_feed;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
