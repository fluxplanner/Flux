-- ════════════════════════════════════════════════════════════════════
-- Owner → one person pop-up messages.
--
-- The owner could already broadcast a sign-in pop-up to everybody
-- (platform_settings.signInPopup). This is the same idea aimed at a single
-- account.
--
-- It deliberately does NOT live in platform_settings. That table is readable
-- by anon by design — it has to be, because the sidebar renders before anyone
-- signs in — and its own comment says never to put anything private there. A
-- message addressed to one student sitting in a world-readable row would be
-- readable by every user and every signed-out visitor.
--
-- So: its own table, with the privacy enforced by RLS rather than by the
-- client remembering to filter. A recipient can read only rows addressed to
-- them; nobody else can read them at all.
--
-- Owner identity follows the convention already used by
-- staff_verification_requests — the email claim on the JWT. Encoding it here
-- rather than deferring to an Edge Function is deliberate: this table needs no
-- service-role writer, so RLS alone keeps the rule in one place, and applying
-- this migration is then the only setup step.
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.owner_direct_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        text NOT NULL DEFAULT 'A message from Flux',
  body         text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   text,
  -- NULL until the recipient has actually been shown it. This is what stops
  -- the pop-up reappearing on every sign-in, and being per-row rather than the
  -- broadcast's per-device "seen signature" means clearing browser storage
  -- does not resurrect a message already read.
  read_at      timestamptz
);

COMMENT ON TABLE public.owner_direct_messages IS
  'Owner-authored pop-up messages addressed to one account. Private: RLS limits SELECT to the recipient. Unlike platform_settings this is never anon-readable.';

-- The only query the client makes: my unread messages, oldest first.
CREATE INDEX IF NOT EXISTS owner_direct_messages_inbox_idx
  ON public.owner_direct_messages (recipient_id, read_at, created_at);

ALTER TABLE public.owner_direct_messages ENABLE ROW LEVEL SECURITY;

-- ── Recipient: read your own, and mark them read ────────────────────────────
DROP POLICY IF EXISTS "odm_recipient_select" ON public.owner_direct_messages;
CREATE POLICY "odm_recipient_select" ON public.owner_direct_messages
  FOR SELECT TO authenticated
  USING (recipient_id = auth.uid());

-- Scoped to your own rows on both sides, so this cannot be used to stamp
-- somebody else's message as read.
DROP POLICY IF EXISTS "odm_recipient_mark_read" ON public.owner_direct_messages;
CREATE POLICY "odm_recipient_mark_read" ON public.owner_direct_messages
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- ── Owner: full access ──────────────────────────────────────────────────────
-- The same email check as staff_verification_requests, kept character-for-
-- character so the two cannot quietly drift apart.
DROP POLICY IF EXISTS "odm_owner_select" ON public.owner_direct_messages;
CREATE POLICY "odm_owner_select" ON public.owner_direct_messages
  FOR SELECT TO authenticated
  USING (lower(trim(coalesce((auth.jwt() ->> 'email')::text, ''))) = 'azfermohammed21@gmail.com');

DROP POLICY IF EXISTS "odm_owner_insert" ON public.owner_direct_messages;
CREATE POLICY "odm_owner_insert" ON public.owner_direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (lower(trim(coalesce((auth.jwt() ->> 'email')::text, ''))) = 'azfermohammed21@gmail.com');

DROP POLICY IF EXISTS "odm_owner_update" ON public.owner_direct_messages;
CREATE POLICY "odm_owner_update" ON public.owner_direct_messages
  FOR UPDATE TO authenticated
  USING (lower(trim(coalesce((auth.jwt() ->> 'email')::text, ''))) = 'azfermohammed21@gmail.com')
  WITH CHECK (lower(trim(coalesce((auth.jwt() ->> 'email')::text, ''))) = 'azfermohammed21@gmail.com');

DROP POLICY IF EXISTS "odm_owner_delete" ON public.owner_direct_messages;
CREATE POLICY "odm_owner_delete" ON public.owner_direct_messages
  FOR DELETE TO authenticated
  USING (lower(trim(coalesce((auth.jwt() ->> 'email')::text, ''))) = 'azfermohammed21@gmail.com');

-- No policy for anon. RLS denies anything not explicitly allowed, so a
-- signed-out visitor cannot read a single row.
