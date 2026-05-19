-- Flux schools registry — International Academy East (IAE) join code for students & staff.

CREATE TABLE IF NOT EXISTS public.flux_schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT NOT NULL,
  join_code TEXT UNIQUE NOT NULL,
  district TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flux_schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flux_schools_read_active" ON public.flux_schools;
CREATE POLICY "flux_schools_read_active" ON public.flux_schools
  FOR SELECT TO authenticated
  USING (active = true);

INSERT INTO public.flux_schools (slug, name, short_name, join_code, district)
VALUES (
  'iae',
  'International Academy East',
  'IAE',
  'IAE-EAST',
  'Bloomfield Hills Schools'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  short_name = EXCLUDED.short_name,
  join_code = EXCLUDED.join_code,
  district = EXCLUDED.district,
  active = true;

-- Default existing educators (no school set) to IAE.
UPDATE public.user_roles
SET school = 'International Academy East',
    updated_at = NOW()
WHERE role IN ('teacher', 'counselor', 'staff', 'admin')
  AND (school IS NULL OR trim(school) = '');

UPDATE public.admin_profiles
SET school_name = 'International Academy East'
WHERE school_name IS NULL OR trim(school_name) = '';

-- Join school by code (validates code server-side).
CREATE OR REPLACE FUNCTION public.join_flux_school(p_join_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  uid UUID;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT id, name, short_name, join_code
  INTO s
  FROM public.flux_schools
  WHERE active = true
    AND upper(trim(join_code)) = upper(trim(coalesce(p_join_code, '')))
  LIMIT 1;

  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  INSERT INTO public.user_roles (user_id, role, school, updated_at)
  VALUES (uid, 'student', s.name, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    school = EXCLUDED.school,
    updated_at = NOW();

  RETURN jsonb_build_object(
    'ok', true,
    'school', s.name,
    'short_name', s.short_name,
    'join_code', s.join_code
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_flux_school(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_flux_school(TEXT) TO authenticated;
