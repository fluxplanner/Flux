-- flux_resolve_feature_flags() failed for every signed-in user:
--   ERROR 42702: column reference "school" is ambiguous
-- (a PL/pgSQL variable and user_roles.school share the name). The client
-- caught the error and used its built-in defaults, so global, per-school and
-- per-user flags in the database never applied. Fixed by renaming the
-- variable and qualifying every column. Applied to FluxPlanner on 2026-10-06.
--
-- With the function working, the database's global defaults take effect.
-- They matched the app's built-in defaults except for one: the database had
-- enable_ai_action_confirm off while the app defaults it on (confirm before
-- the AI takes actions). It's turned on here so the fix changes nothing for
-- anyone except schools with their own overrides (International Academy
-- East's pilot flags: now engine, grade GPS, seasons, study rooms v2, sub
-- plans, ask teacher, school schedules, school ops, ops health panel,
-- counselor caseload).
CREATE OR REPLACE FUNCTION public.flux_resolve_feature_flags()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid UUID := auth.uid();
  v_school TEXT;
  out JSONB := '{}'::jsonb;
  r RECORD;
BEGIN
  IF uid IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  FOR r IN SELECT ff.key, ff.default_enabled FROM public.flux_feature_flags ff LOOP
    out := out || jsonb_build_object(r.key, r.default_enabled);
  END LOOP;

  SELECT NULLIF(trim(ur.school), '') INTO v_school
  FROM public.user_roles ur
  WHERE ur.user_id = uid;

  IF v_school IS NOT NULL THEN
    FOR r IN
      SELECT sff.flag_key AS key, sff.enabled
      FROM public.flux_school_feature_flags sff
      WHERE lower(trim(sff.school_key)) = lower(trim(v_school))
    LOOP
      out := out || jsonb_build_object(r.key, r.enabled);
    END LOOP;
  END IF;

  FOR r IN
    SELECT uff.flag_key AS key, uff.enabled
    FROM public.flux_user_feature_flags uff
    WHERE uff.user_id = uid
  LOOP
    out := out || jsonb_build_object(r.key, r.enabled);
  END LOOP;

  RETURN out;
END;
$function$;

-- CREATE OR REPLACE keeps existing grants; restate them anyway.
REVOKE EXECUTE ON FUNCTION public.flux_resolve_feature_flags() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_resolve_feature_flags() TO authenticated, service_role;

UPDATE public.flux_feature_flags SET default_enabled = true WHERE key = 'enable_ai_action_confirm';
