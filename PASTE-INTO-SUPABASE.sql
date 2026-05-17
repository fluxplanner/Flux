-- ═══ COPY EVERYTHING BELOW THIS LINE INTO SUPABASE SQL EDITOR ═══
-- (This file combines 3 setup scripts in the right order.)

-- ─── PART 1 OF 3 ───
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

-- Counselor self-provision (run if counselor dashboard shows "record not found" for real counselors)
CREATE UNIQUE INDEX IF NOT EXISTS counselors_user_id_key
  ON public.counselors (user_id)
  WHERE user_id IS NOT NULL;

DROP POLICY IF EXISTS "counselors_insert_own" ON public.counselors;
CREATE POLICY "counselors_insert_own" ON public.counselors
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "counselors_claim_email" ON public.counselors;
CREATE POLICY "counselors_claim_email" ON public.counselors
  FOR UPDATE TO authenticated
  USING (
    user_id IS NULL
    AND email IS NOT NULL
    AND length(trim(email)) > 0
    AND lower(trim(email)) = lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')))
  )
  WITH CHECK (user_id = auth.uid());

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

-- ─── PART 2 OF 3 ───
-- ════════════════════════════════════════════════════════════════════
-- FLUX PLANNER — EDUCATOR PLATFORM RLS LOCKDOWN
-- Tighten over-permissive policies so students can't enumerate every
-- class/assignment/announcement in the database. Adds a self-managed
-- `student_class_codes` table + SECURITY DEFINER helpers so the
-- "join class by code" UX still works without leaking the directory.
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────
-- 1. Self-registered class codes (student-controlled subscription list)
-- ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_class_codes (
  student_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_code  TEXT NOT NULL,
  added_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, class_code)
);

ALTER TABLE public.student_class_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scc_student_all" ON public.student_class_codes;
CREATE POLICY "scc_student_all" ON public.student_class_codes
  FOR ALL TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

CREATE INDEX IF NOT EXISTS idx_student_class_codes_code
  ON public.student_class_codes(class_code);

-- ──────────────────────────────────────────────────────────────────
-- 2. teacher_classes — drop wide read, require enrollment OR subscription
--    Joining a new class still works through `flux_lookup_class_by_code`.
-- ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "classes_student_read" ON public.teacher_classes;

CREATE POLICY "classes_student_read" ON public.teacher_classes
  FOR SELECT TO authenticated
  USING (
    active = true
    AND (
      EXISTS (
        SELECT 1 FROM public.teacher_students ts
        WHERE ts.student_id = auth.uid()
          AND ts.active = true
          AND (ts.class_code = public.teacher_classes.class_code
               OR ts.teacher_id = public.teacher_classes.teacher_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.student_class_codes scc
        WHERE scc.student_id = auth.uid()
          AND scc.class_code = public.teacher_classes.class_code
      )
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- 3. teacher_assignments — restrict to subscribed/enrolled students
-- ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "assignments_student_read" ON public.teacher_assignments;

CREATE POLICY "assignments_student_read" ON public.teacher_assignments
  FOR SELECT TO authenticated
  USING (
    visible = true
    AND (
      EXISTS (
        SELECT 1 FROM public.teacher_students ts
        WHERE ts.student_id = auth.uid()
          AND ts.active = true
          AND (ts.class_code = public.teacher_assignments.class_code
               OR ts.teacher_id = public.teacher_assignments.teacher_id)
      )
      OR EXISTS (
        SELECT 1 FROM public.student_class_codes scc
        WHERE scc.student_id = auth.uid()
          AND scc.class_code = public.teacher_assignments.class_code
      )
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- 4. teacher_announcements — same enrollment gate (resolve via class_id)
-- ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "announce_student_read" ON public.teacher_announcements;

CREATE POLICY "announce_student_read" ON public.teacher_announcements
  FOR SELECT TO authenticated
  USING (
    visible = true
    AND class_id IS NOT NULL
    AND class_id IN (
      SELECT tc.id FROM public.teacher_classes tc
      WHERE
        EXISTS (
          SELECT 1 FROM public.teacher_students ts
          WHERE ts.student_id = auth.uid()
            AND ts.active = true
            AND (ts.class_code = tc.class_code OR ts.teacher_id = tc.teacher_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.student_class_codes scc
          WHERE scc.student_id = auth.uid()
            AND scc.class_code = tc.class_code
        )
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- 5. no_homework_days — same enrollment gate
-- ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "nhd_student_read" ON public.no_homework_days;

CREATE POLICY "nhd_student_read" ON public.no_homework_days
  FOR SELECT TO authenticated
  USING (
    class_id IS NOT NULL
    AND class_id IN (
      SELECT tc.id FROM public.teacher_classes tc
      WHERE
        EXISTS (
          SELECT 1 FROM public.teacher_students ts
          WHERE ts.student_id = auth.uid()
            AND ts.active = true
            AND (ts.class_code = tc.class_code OR ts.teacher_id = tc.teacher_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.student_class_codes scc
          WHERE scc.student_id = auth.uid()
            AND scc.class_code = tc.class_code
        )
    )
  );

-- ──────────────────────────────────────────────────────────────────
-- 6. SECURITY DEFINER helpers: lookup-by-code & subscribe
--    Run with elevated privileges so the student gets a single row
--    they need to decide whether to join, without exposing the table.
-- ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.flux_lookup_class_by_code(p_code TEXT)
RETURNS TABLE (
  id          UUID,
  class_name  TEXT,
  teacher_id  UUID,
  subject     TEXT,
  period      TEXT,
  active      BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, class_name, teacher_id, subject, period, active
  FROM public.teacher_classes
  WHERE class_code = p_code
    AND active = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.flux_lookup_class_by_code(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_lookup_class_by_code(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.flux_subscribe_class(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_exists BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.teacher_classes
    WHERE class_code = p_code AND active = true
  ) INTO v_exists;

  IF NOT v_exists THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.student_class_codes (student_id, class_code)
  VALUES (v_uid, p_code)
  ON CONFLICT DO NOTHING;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.flux_subscribe_class(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_subscribe_class(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.flux_unsubscribe_class(p_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM public.student_class_codes
  WHERE student_id = auth.uid() AND class_code = p_code;
END;
$$;

REVOKE ALL ON FUNCTION public.flux_unsubscribe_class(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_unsubscribe_class(TEXT) TO authenticated;

-- ─── PART 3 OF 3 ───
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
