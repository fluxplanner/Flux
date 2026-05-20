-- Fix school join: normalize codes (IA-East / IAE-EAST), preserve role on upsert.

CREATE OR REPLACE FUNCTION public.normalize_flux_school_code(raw TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(regexp_replace(trim(coalesce(raw, '')), '[\s_]+', '-', 'g'));
$$;

UPDATE public.flux_schools
SET join_code = 'IA-EAST'
WHERE slug = 'iae';

CREATE OR REPLACE FUNCTION public.join_flux_school(p_join_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  uid UUID;
  existing_role TEXT;
  norm_code TEXT;
BEGIN
  uid := auth.uid();
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  norm_code := public.normalize_flux_school_code(p_join_code);

  IF norm_code = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT id, name, short_name, join_code
  INTO s
  FROM public.flux_schools
  WHERE active = true
    AND public.normalize_flux_school_code(join_code) = norm_code
  LIMIT 1;

  -- Legacy alias: accept IA-EAST when DB still has IAE-EAST
  IF s.id IS NULL AND norm_code IN ('IA-EAST', 'IAE-EAST') THEN
    SELECT id, name, short_name, join_code
    INTO s
    FROM public.flux_schools
    WHERE active = true
      AND slug = 'iae'
    LIMIT 1;
  END IF;

  IF s.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_code');
  END IF;

  SELECT role INTO existing_role
  FROM public.user_roles
  WHERE user_id = uid;

  IF existing_role IS NULL THEN
    INSERT INTO public.user_roles (user_id, role, school, updated_at)
    VALUES (uid, 'student', s.name, NOW());
  ELSE
    UPDATE public.user_roles
    SET school = s.name,
        updated_at = NOW()
    WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'school', s.name,
    'short_name', s.short_name,
    'join_code', s.join_code
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'server_error',
      'detail', SQLERRM
    );
END;
$$;

REVOKE ALL ON FUNCTION public.join_flux_school(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_flux_school(TEXT) TO authenticated;
