-- ════════════════════════════════════════════════════════════════════
-- FLUX PLANNER — EDUCATOR PLATFORM SCHEMA
-- Run via Supabase CLI or paste into Supabase SQL Editor.
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1. User roles (student / teacher / counselor / staff / admin)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'student'
                  CHECK (role IN ('student', 'teacher', 'counselor', 'staff', 'admin')),
  display_name  TEXT,
  school        TEXT,
  grade_level   TEXT,
  subject       TEXT,
  department    TEXT,
  bio           TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select_own" ON public.user_roles;
CREATE POLICY "roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "roles_select_educators" ON public.user_roles;
CREATE POLICY "roles_select_educators" ON public.user_roles
  FOR SELECT TO authenticated
  USING (role IN ('teacher', 'counselor', 'staff', 'admin'));

DROP POLICY IF EXISTS "roles_insert_own" ON public.user_roles;
CREATE POLICY "roles_insert_own" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "roles_update_own" ON public.user_roles;
CREATE POLICY "roles_update_own" ON public.user_roles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- ──────────────────────────────────────────────────────────────────
-- 2. Teacher classes (class codes for student join)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_classes (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_name   TEXT NOT NULL,
  class_code   TEXT UNIQUE NOT NULL,
  subject      TEXT,
  period       TEXT,
  description  TEXT,
  school_year  TEXT DEFAULT '2025-26',
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teacher_classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "classes_teacher_all" ON public.teacher_classes;
CREATE POLICY "classes_teacher_all" ON public.teacher_classes
  FOR ALL TO authenticated USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "classes_student_read" ON public.teacher_classes;
CREATE POLICY "classes_student_read" ON public.teacher_classes
  FOR SELECT TO authenticated USING (active = true);

CREATE INDEX IF NOT EXISTS idx_teacher_classes_teacher ON public.teacher_classes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_classes_code ON public.teacher_classes(class_code);

-- ──────────────────────────────────────────────────────────────────
-- 3. Teacher-Student enrollments
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_students (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_name  TEXT NOT NULL,
  class_code  TEXT,
  period      TEXT,
  school_year TEXT DEFAULT '2025-26',
  active      BOOLEAN NOT NULL DEFAULT true,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(teacher_id, student_id, class_name)
);

ALTER TABLE public.teacher_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ts_teacher_access" ON public.teacher_students;
CREATE POLICY "ts_teacher_access" ON public.teacher_students
  FOR ALL TO authenticated USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "ts_student_access" ON public.teacher_students;
CREATE POLICY "ts_student_access" ON public.teacher_students
  FOR SELECT TO authenticated USING (auth.uid() = student_id);

CREATE INDEX IF NOT EXISTS idx_teacher_students_teacher ON public.teacher_students(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_students_student ON public.teacher_students(student_id);

-- ──────────────────────────────────────────────────────────────────
-- 4. Teacher-posted assignments (visible to all students in class)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id           UUID REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
  class_code         TEXT,
  title              TEXT NOT NULL,
  description        TEXT,
  due_date           DATE,
  due_time           TIME DEFAULT '23:59:00',
  points_possible    INTEGER DEFAULT 100,
  type               TEXT DEFAULT 'homework'
                       CHECK (type IN ('homework', 'quiz', 'test', 'project', 'essay', 'lab', 'reading', 'other')),
  priority           TEXT DEFAULT 'med' CHECK (priority IN ('high', 'med', 'low')),
  estimated_minutes  INTEGER DEFAULT 30,
  attachment_url     TEXT,
  rubric             JSONB,
  visible            BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assignments_teacher_all" ON public.teacher_assignments;
CREATE POLICY "assignments_teacher_all" ON public.teacher_assignments
  FOR ALL TO authenticated USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "assignments_student_read" ON public.teacher_assignments;
CREATE POLICY "assignments_student_read" ON public.teacher_assignments
  FOR SELECT TO authenticated USING (visible = true);

CREATE INDEX IF NOT EXISTS idx_teacher_assignments_teacher ON public.teacher_assignments(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_class ON public.teacher_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_class_code ON public.teacher_assignments(class_code);
CREATE INDEX IF NOT EXISTS idx_teacher_assignments_due ON public.teacher_assignments(due_date);

-- ──────────────────────────────────────────────────────────────────
-- 5. Student completions (teacher can see who completed what)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_completions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.teacher_assignments(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'in_progress', 'submitted', 'graded', 'late', 'missing')),
  submitted_at  TIMESTAMPTZ,
  grade         NUMERIC(5,2),
  feedback      TEXT,
  teacher_note  TEXT,
  student_note  TEXT,
  UNIQUE(assignment_id, student_id)
);

ALTER TABLE public.student_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "completions_student_own" ON public.student_completions;
CREATE POLICY "completions_student_own" ON public.student_completions
  FOR ALL TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "completions_teacher_read" ON public.student_completions;
CREATE POLICY "completions_teacher_read" ON public.student_completions
  FOR SELECT TO authenticated
  USING (assignment_id IN (
    SELECT id FROM public.teacher_assignments WHERE teacher_id = auth.uid()
  ));

DROP POLICY IF EXISTS "completions_teacher_update" ON public.student_completions;
CREATE POLICY "completions_teacher_update" ON public.student_completions
  FOR UPDATE TO authenticated
  USING (assignment_id IN (
    SELECT id FROM public.teacher_assignments WHERE teacher_id = auth.uid()
  ));

CREATE INDEX IF NOT EXISTS idx_completions_assignment ON public.student_completions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_completions_student ON public.student_completions(student_id);

-- ──────────────────────────────────────────────────────────────────
-- 6. Messaging — threads and messages
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.flux_threads (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_2        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject              TEXT,
  last_message_at      TIMESTAMPTZ DEFAULT NOW(),
  last_message_preview TEXT,
  UNIQUE(participant_1, participant_2)
);

CREATE TABLE IF NOT EXISTS public.flux_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id    UUID NOT NULL,
  sender_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,
  read         BOOLEAN NOT NULL DEFAULT false,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flux_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flux_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_own" ON public.flux_messages;
CREATE POLICY "messages_own" ON public.flux_messages
  FOR ALL TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS "threads_own" ON public.flux_threads;
CREATE POLICY "threads_own" ON public.flux_threads
  FOR ALL TO authenticated
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE INDEX IF NOT EXISTS idx_flux_messages_thread ON public.flux_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_flux_messages_recipient ON public.flux_messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_flux_messages_sender ON public.flux_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_flux_threads_p1 ON public.flux_threads(participant_1);
CREATE INDEX IF NOT EXISTS idx_flux_threads_p2 ON public.flux_threads(participant_2);

-- ──────────────────────────────────────────────────────────────────
-- 7. Counselors — directory of school counselors
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.counselors (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  email            TEXT,
  bio              TEXT,
  avatar_initial   TEXT,
  avatar_color     TEXT DEFAULT '#6c63ff',
  availability     JSONB,
  booking_enabled  BOOLEAN NOT NULL DEFAULT true,
  active           BOOLEAN NOT NULL DEFAULT true
);

ALTER TABLE public.counselors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "counselors_public_read" ON public.counselors;
CREATE POLICY "counselors_public_read" ON public.counselors
  FOR SELECT TO authenticated USING (active = true);

DROP POLICY IF EXISTS "counselors_own_update" ON public.counselors;
CREATE POLICY "counselors_own_update" ON public.counselors
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Seed default counselors (idempotent via WHERE NOT EXISTS)
INSERT INTO public.counselors (name, email, avatar_initial, avatar_color, bio, availability)
SELECT
  'Mrs. Bernstein',
  'bernstein@school.edu',
  'B',
  '#7c5cff',
  'School counselor specializing in academic planning, college preparation, and student wellbeing.',
  '{
    "monday": ["9:00 AM","9:30 AM","10:00 AM","10:30 AM","2:00 PM","2:30 PM","3:00 PM"],
    "tuesday": ["9:00 AM","9:30 AM","11:00 AM","11:30 AM","1:00 PM","1:30 PM"],
    "wednesday": ["10:00 AM","10:30 AM","11:00 AM","2:00 PM","2:30 PM"],
    "thursday": ["9:00 AM","9:30 AM","1:00 PM","1:30 PM","2:00 PM"],
    "friday": ["9:00 AM","10:00 AM","10:30 AM"]
  }'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.counselors WHERE name = 'Mrs. Bernstein');

INSERT INTO public.counselors (name, email, avatar_initial, avatar_color, bio, availability)
SELECT
  'Mrs. Phelps',
  'phelps@school.edu',
  'P',
  '#00bfff',
  'Dedicated to helping students navigate high school, manage stress, and plan for their future.',
  '{
    "monday": ["10:00 AM","10:30 AM","11:00 AM","1:00 PM","1:30 PM"],
    "tuesday": ["9:00 AM","9:30 AM","10:00 AM","2:00 PM","2:30 PM","3:00 PM"],
    "wednesday": ["9:00 AM","9:30 AM","1:30 PM","2:00 PM","2:30 PM"],
    "thursday": ["10:00 AM","10:30 AM","11:00 AM","1:00 PM","1:30 PM"],
    "friday": ["9:00 AM","9:30 AM","10:00 AM","10:30 AM"]
  }'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.counselors WHERE name = 'Mrs. Phelps');

-- ──────────────────────────────────────────────────────────────────
-- 8. Counselor appointments
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.counselor_appointments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  counselor_id     UUID NOT NULL REFERENCES public.counselors(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date             DATE NOT NULL,
  time_slot        TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  reason           TEXT,
  notes            TEXT,
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
  counselor_notes  TEXT,
  meeting_link     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(counselor_id, date, time_slot)
);

ALTER TABLE public.counselor_appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "appts_student_own" ON public.counselor_appointments;
CREATE POLICY "appts_student_own" ON public.counselor_appointments
  FOR ALL TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "appts_counselor_read" ON public.counselor_appointments;
CREATE POLICY "appts_counselor_read" ON public.counselor_appointments
  FOR SELECT TO authenticated
  USING (counselor_id IN (SELECT id FROM public.counselors WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "appts_counselor_update" ON public.counselor_appointments;
CREATE POLICY "appts_counselor_update" ON public.counselor_appointments
  FOR UPDATE TO authenticated
  USING (counselor_id IN (SELECT id FROM public.counselors WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_appts_counselor ON public.counselor_appointments(counselor_id);
CREATE INDEX IF NOT EXISTS idx_appts_student ON public.counselor_appointments(student_id);
CREATE INDEX IF NOT EXISTS idx_appts_date ON public.counselor_appointments(date);

-- ──────────────────────────────────────────────────────────────────
-- 9. Student-counselor assignments (which counselor each student picked)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_counselors (
  student_id   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  counselor_id UUID NOT NULL REFERENCES public.counselors(id),
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.student_counselors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sc_own" ON public.student_counselors;
CREATE POLICY "sc_own" ON public.student_counselors
  FOR ALL TO authenticated USING (auth.uid() = student_id);

DROP POLICY IF EXISTS "sc_counselor_read" ON public.student_counselors;
CREATE POLICY "sc_counselor_read" ON public.student_counselors
  FOR SELECT TO authenticated
  USING (counselor_id IN (SELECT id FROM public.counselors WHERE user_id = auth.uid()));

-- ──────────────────────────────────────────────────────────────────
-- 10. Teacher announcements
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teacher_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id    UUID REFERENCES public.teacher_classes(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  content     TEXT NOT NULL,
  priority    TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'important', 'urgent')),
  visible     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.teacher_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "announce_teacher_all" ON public.teacher_announcements;
CREATE POLICY "announce_teacher_all" ON public.teacher_announcements
  FOR ALL TO authenticated USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "announce_student_read" ON public.teacher_announcements;
CREATE POLICY "announce_student_read" ON public.teacher_announcements
  FOR SELECT TO authenticated USING (visible = true);

-- ──────────────────────────────────────────────────────────────────
-- 11. No-homework days (teachers can post these per class)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.no_homework_days (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id    UUID REFERENCES public.teacher_classes(id),
  date        DATE NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.no_homework_days ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nhd_teacher_all" ON public.no_homework_days;
CREATE POLICY "nhd_teacher_all" ON public.no_homework_days
  FOR ALL TO authenticated USING (auth.uid() = teacher_id);

DROP POLICY IF EXISTS "nhd_student_read" ON public.no_homework_days;
CREATE POLICY "nhd_student_read" ON public.no_homework_days
  FOR SELECT TO authenticated USING (true);

-- ──────────────────────────────────────────────────────────────────
-- 12. Realtime — enable for messaging & appointments
-- ──────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Idempotent: add if not already in publication
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.flux_messages; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.flux_threads; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.counselor_appointments; EXCEPTION WHEN duplicate_object THEN NULL; END;
    BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.teacher_announcements; EXCEPTION WHEN duplicate_object THEN NULL; END;
  END IF;
END $$;
