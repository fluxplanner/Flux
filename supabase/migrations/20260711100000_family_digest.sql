-- C6 — Family Digest (flag enable_family_digest).
--
-- Weekly guardian email: wins first, then the upcoming week, in the
-- guardian's language. Rides the existing family-sharing relationship
-- (flux_parent_links, P7-PARENT) — the STUDENT owns the link rows (RLS
-- "flux_parent_links_student_all"), so opting in, language, channel, and
-- included categories are all student-controlled. Defaults are
-- conservative: opt-in OFF, categories wins+upcoming only (no wellbeing,
-- no grades — grades are never included at any setting).
--
-- Rollback:
--   DROP TABLE IF EXISTS public.flux_family_digests;
--   ALTER TABLE public.flux_parent_links
--     DROP COLUMN IF EXISTS digest_opt_in,
--     DROP COLUMN IF EXISTS digest_language,
--     DROP COLUMN IF EXISTS digest_channel,
--     DROP COLUMN IF EXISTS digest_categories;
--   DELETE FROM public.flux_feature_flags WHERE key = 'enable_family_digest';

ALTER TABLE public.flux_parent_links
  ADD COLUMN IF NOT EXISTS digest_opt_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS digest_language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS digest_channel TEXT NOT NULL DEFAULT 'email'
    CHECK (digest_channel IN ('email', 'none')),
  ADD COLUMN IF NOT EXISTS digest_categories JSONB NOT NULL DEFAULT '["wins","upcoming"]';

-- One row per link per week: idempotency for the cron + an auditable record
-- of exactly what was shared with the guardian.
CREATE TABLE IF NOT EXISTS public.flux_family_digests (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id    UUID NOT NULL REFERENCES public.flux_parent_links(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}',
  status     TEXT NOT NULL DEFAULT 'rendered'
             CHECK (status IN ('rendered', 'sent', 'skipped', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (link_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_family_digests_student
  ON public.flux_family_digests(student_id, week_start DESC);

ALTER TABLE public.flux_family_digests ENABLE ROW LEVEL SECURITY;

-- Students see every digest generated about them (transparency); guardians
-- see digests for their active link. Writes are service-role only (cron).
DROP POLICY IF EXISTS "family_digests_student_select" ON public.flux_family_digests;
CREATE POLICY "family_digests_student_select" ON public.flux_family_digests
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "family_digests_parent_select" ON public.flux_family_digests;
CREATE POLICY "family_digests_parent_select" ON public.flux_family_digests
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.flux_parent_links pl
      WHERE pl.id = flux_family_digests.link_id
        AND pl.parent_id = auth.uid()
        AND pl.status = 'active'
    )
  );

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_family_digest', 'Weekly guardian digest: wins first, then the upcoming week, in the guardian''s language; student-controlled categories', false, 'parent')
ON CONFLICT (key) DO NOTHING;
