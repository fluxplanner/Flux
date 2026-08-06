-- C11 — Student → counselor help tickets (flag enable_counselor_help_tickets).
--
-- Mirrors the Ask-Your-Teacher handoff (C10) but routed to the student's
-- ASSIGNED counselor, and — unlike C10, which rides the existing
-- flux_threads/flux_messages pipeline — this one needs durable state:
-- open → in_progress → resolved, an assignee, and a student-visible status.
-- That is a ticket, not a message, so it gets its own table.
--
-- Two tables, deliberately split by who may read them:
--
--   flux_help_tickets        student-authored, student-readable (their own
--                            rows only) + assigned counselor. The student can
--                            always see what they wrote and where it stands.
--
--   flux_help_ticket_notes   counselor-private working notes. There is NO
--                            student policy on this table at all — not a
--                            filtered one, none. A student must never read a
--                            counselor's notes about them, so the safest
--                            policy is the absent one.
--
-- Urgency: 'normal' | 'urgent'. An urgent ticket is a wellbeing escalation —
-- it pins to the top of the counselor risk queue regardless of consent tier,
-- because a student who asks for help by name has consented by construction
-- (same reasoning as C10's context card). The client shows crisis-line
-- resources and an honest "a counselor sees this at <next school morning>"
-- the moment it is filed; nothing here promises after-hours staffing.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.flux_help_ticket_notes;
--   DROP TABLE IF EXISTS public.flux_help_tickets;
--   DELETE FROM public.flux_feature_flags WHERE key = 'enable_counselor_help_tickets';

CREATE TABLE IF NOT EXISTS public.flux_help_tickets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  counselor_id    UUID NOT NULL REFERENCES public.counselors(id) ON DELETE CASCADE,
  school          TEXT NOT NULL,
  topic           TEXT NOT NULL DEFAULT 'other'
    CHECK (topic IN ('schedule', 'workload', 'personal', 'college', 'other')),
  body            TEXT NOT NULL
    CHECK (length(btrim(body)) > 0 AND length(body) <= 2000),
  urgency         TEXT NOT NULL DEFAULT 'normal'
    CHECK (urgency IN ('normal', 'urgent')),
  status          TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved')),
  -- Who picked it up. Nullable: an unassigned ticket is still a real ticket.
  assigned_to     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.flux_help_tickets IS
  'Student-filed help requests routed to their assigned counselor. Student reads own rows only.';
COMMENT ON COLUMN public.flux_help_tickets.urgency IS
  'urgent = wellbeing escalation; pins to top of counselor risk queue irrespective of consent tier';

-- Counselor triage: open/urgent first, newest first.
CREATE INDEX IF NOT EXISTS idx_help_tickets_counselor_status
  ON public.flux_help_tickets (counselor_id, status, urgency, created_at DESC);
-- Student's own ticket list.
CREATE INDEX IF NOT EXISTS idx_help_tickets_student
  ON public.flux_help_tickets (student_id, created_at DESC);

ALTER TABLE public.flux_help_tickets ENABLE ROW LEVEL SECURITY;

-- Student may file a ticket only for themselves, and only to a counselor they
-- are actually linked to (mirrors scc_student_insert on the check-ins table).
DROP POLICY IF EXISTS "help_tickets_student_insert" ON public.flux_help_tickets;
CREATE POLICY "help_tickets_student_insert" ON public.flux_help_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.student_counselors sc
      WHERE sc.student_id = auth.uid()
        AND sc.counselor_id = flux_help_tickets.counselor_id
    )
  );

-- A student sees their own tickets — and only their own. This is the row that
-- carries the status back to them, so it must be readable; the USING clause is
-- what keeps it from ever being anyone else's.
DROP POLICY IF EXISTS "help_tickets_student_read_own" ON public.flux_help_tickets;
CREATE POLICY "help_tickets_student_read_own" ON public.flux_help_tickets
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Students deliberately get no UPDATE/DELETE policy: status is the counselor's
-- to move, and a filed wellbeing escalation should not be silently retractable.

DROP POLICY IF EXISTS "help_tickets_counselor_all" ON public.flux_help_tickets;
CREATE POLICY "help_tickets_counselor_all" ON public.flux_help_tickets
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.counselors c
      WHERE c.id = flux_help_tickets.counselor_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.counselors c
      WHERE c.id = flux_help_tickets.counselor_id
        AND c.user_id = auth.uid()
    )
  );

-- ── Counselor-private notes ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.flux_help_ticket_notes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id         UUID NOT NULL REFERENCES public.flux_help_tickets(id) ON DELETE CASCADE,
  counselor_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note_body         TEXT NOT NULL CHECK (length(btrim(note_body)) > 0),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.flux_help_ticket_notes IS
  'Counselor-private triage notes. No student-facing policy exists on this table by design.';

CREATE INDEX IF NOT EXISTS idx_help_ticket_notes_ticket
  ON public.flux_help_ticket_notes (ticket_id, created_at DESC);

ALTER TABLE public.flux_help_ticket_notes ENABLE ROW LEVEL SECURITY;

-- Author-only. Scoped to the note's own author rather than "any counselor on
-- the ticket" so a reassignment never retroactively exposes someone else's
-- private wording. The WITH CHECK additionally pins the note to a ticket the
-- author actually owns, so notes cannot be attached to a stranger's ticket.
DROP POLICY IF EXISTS "help_ticket_notes_counselor_all" ON public.flux_help_ticket_notes;
CREATE POLICY "help_ticket_notes_counselor_all" ON public.flux_help_ticket_notes
  FOR ALL TO authenticated
  USING (counselor_user_id = auth.uid())
  WITH CHECK (
    counselor_user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.flux_help_tickets t
      JOIN public.counselors c ON c.id = t.counselor_id
      WHERE t.id = flux_help_ticket_notes.ticket_id
        AND c.user_id = auth.uid()
    )
  );

-- ── Feature flag ─────────────────────────────────────────────────────────────

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_counselor_help_tickets', 'Student help tickets to their counselor: status tracking, assignment, urgent wellbeing escalation', false, 'counselor')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
