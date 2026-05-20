-- Flux feature flags — school + user overrides for phased rollout.
-- Idempotent. Pair with public/js/flux-feature-flags.js

CREATE TABLE IF NOT EXISTS public.flux_feature_flags (
  key             TEXT PRIMARY KEY,
  description     TEXT,
  default_enabled BOOLEAN NOT NULL DEFAULT false,
  category        TEXT NOT NULL DEFAULT 'general',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.flux_school_feature_flags (
  school_key  TEXT NOT NULL,
  flag_key    TEXT NOT NULL REFERENCES public.flux_feature_flags(key) ON DELETE CASCADE,
  enabled     BOOLEAN NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school_key, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_flux_school_feature_flags_key
  ON public.flux_school_feature_flags(flag_key);

CREATE TABLE IF NOT EXISTS public.flux_user_feature_flags (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flag_key    TEXT NOT NULL REFERENCES public.flux_feature_flags(key) ON DELETE CASCADE,
  enabled     BOOLEAN NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, flag_key)
);

ALTER TABLE public.flux_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flux_school_feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flux_user_feature_flags ENABLE ROW LEVEL SECURITY;

-- Catalog readable by any signed-in user (keys only, no secrets).
DROP POLICY IF EXISTS "flux_flags_catalog_read" ON public.flux_feature_flags;
CREATE POLICY "flux_flags_catalog_read" ON public.flux_feature_flags
  FOR SELECT TO authenticated USING (true);

-- Users manage their own overrides.
DROP POLICY IF EXISTS "flux_user_flags_own" ON public.flux_user_feature_flags;
CREATE POLICY "flux_user_flags_own" ON public.flux_user_feature_flags
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- School overrides: admins only (school-scoped).
DROP POLICY IF EXISTS "flux_school_flags_admin" ON public.flux_school_feature_flags;
CREATE POLICY "flux_school_flags_admin" ON public.flux_school_feature_flags
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_momentum_v2', 'Multi-domain momentum engine v2', false, 'student'),
  ('enable_cognitive_ui', 'Adaptive overload / momentum UI density', false, 'student'),
  ('enable_teacher_ai', 'Teacher AI lesson + copilot tools', false, 'teacher'),
  ('enable_live_class_mode', 'Immersive Start Class mode', false, 'teacher'),
  ('enable_cognitive_predictions', 'Predictive overload / engagement hints', false, 'intelligence'),
  ('enable_counselor_insights', 'Counselor wellness timeline + alerts', false, 'counselor'),
  ('enable_school_command', 'Admin school command center v2', false, 'admin'),
  ('enable_parent_portal', 'Parent visibility portal', false, 'parent'),
  ('enable_staff_google_hub', 'Staff Google integrations tab', true, 'integrations'),
  ('enable_classroom_sync', 'Google Classroom deep sync', false, 'integrations'),
  ('enable_event_bus', 'Client + server event bus processors', false, 'platform')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();

-- Resolve effective flags: defaults → school (by user_roles.school) → user override.
CREATE OR REPLACE FUNCTION public.flux_resolve_feature_flags()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  school TEXT;
  out JSONB := '{}'::jsonb;
  r RECORD;
BEGIN
  IF uid IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  FOR r IN SELECT key, default_enabled FROM public.flux_feature_flags LOOP
    out := out || jsonb_build_object(r.key, r.default_enabled);
  END LOOP;

  SELECT NULLIF(trim(school), '') INTO school
  FROM public.user_roles
  WHERE user_id = uid;

  IF school IS NOT NULL THEN
    FOR r IN
      SELECT sff.flag_key AS key, sff.enabled
      FROM public.flux_school_feature_flags sff
      WHERE lower(trim(sff.school_key)) = lower(trim(school))
    LOOP
      out := out || jsonb_build_object(r.key, r.enabled);
    END LOOP;
  END IF;

  FOR r IN
    SELECT flag_key AS key, enabled
    FROM public.flux_user_feature_flags
    WHERE user_id = uid
  LOOP
    out := out || jsonb_build_object(r.key, r.enabled);
  END LOOP;

  RETURN out;
END;
$$;

REVOKE ALL ON FUNCTION public.flux_resolve_feature_flags() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_resolve_feature_flags() TO authenticated;
