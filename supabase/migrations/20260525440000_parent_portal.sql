-- P7-PARENT: parent portal — invite links + consent-gated student snapshots.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_parent_portal', 'Parent visibility portal (invite code + aggregates only)', false, 'parent')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();

ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_role_check;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('student', 'teacher', 'counselor', 'staff', 'admin', 'parent'));

CREATE TABLE IF NOT EXISTS public.flux_parent_links (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id       UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invite_code     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'revoked')),
  visibility_tier TEXT NOT NULL DEFAULT 'basic'
    CHECK (visibility_tier IN ('none', 'basic', 'wellness')),
  school_key      TEXT,
  student_label   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ,
  CONSTRAINT flux_parent_links_code_len CHECK (char_length(invite_code) BETWEEN 6 AND 16),
  CONSTRAINT flux_parent_links_unique_code UNIQUE (invite_code)
);

CREATE INDEX IF NOT EXISTS idx_flux_parent_links_student
  ON public.flux_parent_links (student_id, status);

CREATE INDEX IF NOT EXISTS idx_flux_parent_links_parent
  ON public.flux_parent_links (parent_id, status)
  WHERE parent_id IS NOT NULL;

ALTER TABLE public.flux_parent_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flux_parent_links_student_all" ON public.flux_parent_links;
CREATE POLICY "flux_parent_links_student_all" ON public.flux_parent_links
  FOR ALL TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);

DROP POLICY IF EXISTS "flux_parent_links_parent_select" ON public.flux_parent_links;
CREATE POLICY "flux_parent_links_parent_select" ON public.flux_parent_links
  FOR SELECT TO authenticated
  USING (auth.uid() = parent_id AND status = 'active');

DROP POLICY IF EXISTS "flux_parent_links_parent_update_claim" ON public.flux_parent_links;
CREATE POLICY "flux_parent_links_parent_update_claim" ON public.flux_parent_links
  FOR UPDATE TO authenticated
  USING (status = 'pending' AND parent_id IS NULL)
  WITH CHECK (auth.uid() = parent_id);

CREATE OR REPLACE FUNCTION public.flux_parent_gen_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  out TEXT := '';
  i INT;
BEGIN
  FOR i IN 1..8 LOOP
    out := out || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN out;
END;
$$;

CREATE OR REPLACE FUNCTION public.flux_parent_create_invite(
  p_tier TEXT DEFAULT 'basic',
  p_label TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tier TEXT;
  code TEXT;
  tries INT := 0;
  link_id UUID;
  school TEXT;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  tier := CASE
    WHEN lower(trim(coalesce(p_tier, ''))) = 'wellness' THEN 'wellness'
    WHEN lower(trim(coalesce(p_tier, ''))) = 'none' THEN 'none'
    ELSE 'basic'
  END;

  SELECT NULLIF(trim(ur.school), '') INTO school FROM public.user_roles ur WHERE ur.user_id = uid;

  LOOP
    code := public.flux_parent_gen_code();
    BEGIN
      INSERT INTO public.flux_parent_links (student_id, invite_code, visibility_tier, school_key, student_label, status)
      VALUES (uid, code, tier, school, left(trim(coalesce(p_label, '')), 64), 'pending')
      RETURNING id INTO link_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      tries := tries + 1;
      IF tries > 12 THEN
        RETURN jsonb_build_object('ok', false, 'error', 'code_generation');
      END IF;
    END;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'link_id', link_id, 'invite_code', code, 'visibility_tier', tier);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_parent_create_invite(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_parent_create_invite(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.flux_parent_claim_invite(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  code TEXT;
  row public.flux_parent_links%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  code := upper(trim(coalesce(p_code, '')));
  IF char_length(code) < 6 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT * INTO row FROM public.flux_parent_links WHERE invite_code = code FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF row.status <> 'pending' OR row.parent_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_claimed');
  END IF;

  IF row.student_id = uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'self_link');
  END IF;

  UPDATE public.flux_parent_links
  SET parent_id = uid, status = 'active', claimed_at = NOW()
  WHERE id = row.id;

  RETURN jsonb_build_object(
    'ok', true,
    'link_id', row.id,
    'student_id', row.student_id,
    'visibility_tier', row.visibility_tier,
    'student_label', row.student_label
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flux_parent_claim_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_parent_claim_invite(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.flux_parent_list_children()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  rows JSONB;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'link_id', pl.id,
    'student_id', pl.student_id,
    'visibility_tier', pl.visibility_tier,
    'student_label', pl.student_label,
    'claimed_at', pl.claimed_at
  ) ORDER BY pl.claimed_at DESC NULLS LAST), '[]'::jsonb)
  INTO rows
  FROM public.flux_parent_links pl
  WHERE pl.parent_id = uid AND pl.status = 'active';

  RETURN jsonb_build_object('ok', true, 'children', rows);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_parent_list_children() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_parent_list_children() TO authenticated;

CREATE OR REPLACE FUNCTION public.flux_parent_child_snapshot(p_student_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tier TEXT;
  snaps JSONB;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT pl.visibility_tier INTO tier
  FROM public.flux_parent_links pl
  WHERE pl.parent_id = uid AND pl.student_id = p_student_id AND pl.status = 'active';

  IF tier IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  IF tier = 'none' THEN
    RETURN jsonb_build_object('ok', true, 'tier', tier, 'has_data', false);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'date', s.snapshot_date,
    'mood', s.mood,
    'stress', s.stress,
    'load_score', s.load_score,
    'momentum_score', s.momentum_score
  ) ORDER BY s.snapshot_date DESC), '[]'::jsonb)
  INTO snaps
  FROM (
    SELECT snapshot_date, mood, stress, load_score, momentum_score
    FROM public.student_wellness_snapshots
    WHERE student_id = p_student_id
    ORDER BY snapshot_date DESC
    LIMIT CASE WHEN tier = 'wellness' THEN 14 ELSE 3 END
  ) s;

  RETURN jsonb_build_object(
    'ok', true,
    'tier', tier,
    'has_data', jsonb_array_length(snaps) > 0,
    'snapshots', snaps,
    'note', 'Aggregates only — no task titles, grades, or messages.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flux_parent_child_snapshot(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_parent_child_snapshot(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.flux_parent_student_list_invites()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  rows JSONB;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'link_id', pl.id,
    'invite_code', pl.invite_code,
    'status', pl.status,
    'visibility_tier', pl.visibility_tier,
    'parent_id', pl.parent_id,
    'claimed_at', pl.claimed_at,
    'created_at', pl.created_at
  ) ORDER BY pl.created_at DESC), '[]'::jsonb)
  INTO rows
  FROM public.flux_parent_links pl
  WHERE pl.student_id = uid AND pl.status <> 'revoked';

  RETURN jsonb_build_object('ok', true, 'invites', rows);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_parent_student_list_invites() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_parent_student_list_invites() TO authenticated;

CREATE OR REPLACE FUNCTION public.flux_parent_student_set_tier(p_link_id UUID, p_tier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  tier TEXT;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  tier := CASE
    WHEN lower(trim(coalesce(p_tier, ''))) = 'wellness' THEN 'wellness'
    WHEN lower(trim(coalesce(p_tier, ''))) = 'none' THEN 'none'
    ELSE 'basic'
  END;

  UPDATE public.flux_parent_links
  SET visibility_tier = tier
  WHERE id = p_link_id AND student_id = uid AND status IN ('pending', 'active');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true, 'visibility_tier', tier);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_parent_student_set_tier(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_parent_student_set_tier(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.flux_parent_revoke_link(p_link_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  UPDATE public.flux_parent_links
  SET status = 'revoked', revoked_at = NOW()
  WHERE id = p_link_id AND (student_id = uid OR parent_id = uid) AND status = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_parent_revoke_link(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_parent_revoke_link(UUID) TO authenticated;

-- Parents may read wellness snapshots for linked wellness-tier students.
CREATE OR REPLACE FUNCTION public.parent_can_read_student_wellness(p_student_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.flux_parent_links pl
    WHERE pl.parent_id = auth.uid()
      AND pl.student_id = p_student_id
      AND pl.status = 'active'
      AND pl.visibility_tier = 'wellness'
  );
$$;

DROP POLICY IF EXISTS "sws_parent_select" ON public.student_wellness_snapshots;
CREATE POLICY "sws_parent_select" ON public.student_wellness_snapshots
  FOR SELECT TO authenticated
  USING (public.parent_can_read_student_wellness(student_id));
