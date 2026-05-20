-- P5-DISTRICT: multi-school district rollup (schema + RLS + metrics RPC).

CREATE TABLE IF NOT EXISTS public.flux_districts (
  slug       TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flux_districts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flux_districts_read" ON public.flux_districts;
CREATE POLICY "flux_districts_read" ON public.flux_districts
  FOR SELECT TO authenticated USING (active = true);

INSERT INTO public.flux_districts (slug, name) VALUES
  ('bloomfield', 'Bloomfield Hills Schools')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, active = true;

ALTER TABLE public.flux_schools
  ADD COLUMN IF NOT EXISTS district_slug TEXT REFERENCES public.flux_districts(slug);

UPDATE public.flux_schools
SET district_slug = 'bloomfield'
WHERE district_slug IS NULL
  AND district IS NOT NULL
  AND district ILIKE '%bloomfield%';

UPDATE public.flux_schools
SET district_slug = 'bloomfield'
WHERE slug = 'iae' AND district_slug IS NULL;

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS school_slug TEXT;

UPDATE public.user_roles ur
SET school_slug = fs.slug
FROM public.flux_schools fs
WHERE ur.school_slug IS NULL
  AND ur.school IS NOT NULL
  AND lower(trim(ur.school)) = lower(trim(fs.name));

CREATE TABLE IF NOT EXISTS public.flux_district_admins (
  user_id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  district_slug  TEXT NOT NULL REFERENCES public.flux_districts(slug),
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flux_district_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fda_own_select" ON public.flux_district_admins;
CREATE POLICY "fda_own_select" ON public.flux_district_admins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "fda_admin_manage" ON public.flux_district_admins;
CREATE POLICY "fda_admin_manage" ON public.flux_district_admins
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

CREATE OR REPLACE FUNCTION public.flux_resolve_user_district(p_uid UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT district_slug FROM public.flux_district_admins WHERE user_id = p_uid),
    (
      SELECT fs.district_slug
      FROM public.user_roles ur
      JOIN public.flux_schools fs
        ON fs.slug = ur.school_slug
        OR lower(trim(fs.name)) = lower(trim(ur.school))
      WHERE ur.user_id = p_uid
        AND ur.role IN ('admin', 'staff')
        AND fs.district_slug IS NOT NULL
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.flux_district_rollup_metrics(p_district_slug TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  d_slug TEXT;
  is_global_admin BOOLEAN;
  is_district_admin BOOLEAN;
  schools_json JSONB;
  totals JSONB;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  d_slug := coalesce(nullif(trim(p_district_slug), ''), public.flux_resolve_user_district(uid));

  IF d_slug IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_district');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = uid AND ur.role = 'admin'
  ) INTO is_global_admin;

  SELECT EXISTS (
    SELECT 1 FROM public.flux_district_admins fda
    WHERE fda.user_id = uid AND fda.district_slug = d_slug
  ) INTO is_district_admin;

  IF NOT is_global_admin AND NOT is_district_admin THEN
    IF public.flux_resolve_user_district(uid) IS DISTINCT FROM d_slug THEN
      RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
    END IF;
  END IF;

  SELECT coalesce(jsonb_agg(school_row ORDER BY school_row->>'name'), '[]'::jsonb)
  INTO schools_json
  FROM (
    SELECT jsonb_build_object(
      'slug', fs.slug,
      'name', fs.name,
      'short_name', fs.short_name,
      'students', (
        SELECT COUNT(*)::int FROM public.user_roles ur
        WHERE ur.role = 'student'
          AND (ur.school_slug = fs.slug OR lower(trim(ur.school)) = lower(trim(fs.name)))
      ),
      'teachers', (
        SELECT COUNT(*)::int FROM public.user_roles ur
        WHERE ur.role = 'teacher'
          AND (ur.school_slug = fs.slug OR lower(trim(ur.school)) = lower(trim(fs.name)))
      ),
      'counselors', (
        SELECT COUNT(*)::int FROM public.user_roles ur
        WHERE ur.role = 'counselor'
          AND (ur.school_slug = fs.slug OR lower(trim(ur.school)) = lower(trim(fs.name)))
      ),
      'staff', (
        SELECT COUNT(*)::int FROM public.user_roles ur
        WHERE ur.role IN ('staff', 'admin')
          AND (ur.school_slug = fs.slug OR lower(trim(ur.school)) = lower(trim(fs.name)))
      ),
      'active_classes', (
        SELECT COUNT(*)::int FROM public.teacher_classes tc
        WHERE tc.active = true
          AND tc.teacher_id IN (
            SELECT ur2.user_id FROM public.user_roles ur2
            WHERE ur2.role = 'teacher'
              AND (ur2.school_slug = fs.slug OR lower(trim(ur2.school)) = lower(trim(fs.name)))
          )
      )
    ) AS school_row
    FROM public.flux_schools fs
    WHERE fs.active = true AND fs.district_slug = d_slug
  ) sub;

  SELECT jsonb_build_object(
    'students', coalesce(SUM((s->>'students')::int), 0),
    'teachers', coalesce(SUM((s->>'teachers')::int), 0),
    'counselors', coalesce(SUM((s->>'counselors')::int), 0),
    'staff', coalesce(SUM((s->>'staff')::int), 0),
    'active_classes', coalesce(SUM((s->>'active_classes')::int), 0),
    'school_count', jsonb_array_length(schools_json)
  )
  INTO totals
  FROM jsonb_array_elements(schools_json) AS s;

  RETURN jsonb_build_object(
    'ok', true,
    'generated_at', NOW(),
    'district', (
      SELECT jsonb_build_object('slug', d.slug, 'name', d.name)
      FROM public.flux_districts d WHERE d.slug = d_slug
    ),
    'schools', schools_json,
    'totals', totals
  );
END;
$$;

REVOKE ALL ON FUNCTION public.flux_resolve_user_district(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_resolve_user_district(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.flux_district_rollup_metrics(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_district_rollup_metrics(TEXT) TO authenticated;

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_district_rollup', 'District multi-school rollup dashboard for admins', false, 'admin')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
