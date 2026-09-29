-- Two small hardenings the Supabase security advisor flagged.
--
-- 1. Pin search_path on the three helpers that had none. All three are
--    SECURITY INVOKER and use only built-ins, so this changes nothing they do;
--    it just stops a caller's search_path from redirecting them.
--
-- 2. Parent invite codes come from a cryptographically strong source.
--    flux_parent_gen_code built its 8 characters from random(), which is not
--    meant to be unguessable — and whoever holds a code can claim the link to
--    a student's planner (flux_parent_claim_invite). The parent portal is off
--    (enable_parent_portal) and no links exist, so nothing was exposed; this is
--    so it is safe on the day it is switched on. gen_random_uuid() is built in
--    and strongly random; the alphabet has exactly 32 symbols, so byte % 32 is
--    unbiased, and bytes 6 and 8 (the uuid's fixed version and variant bits)
--    are skipped. Same alphabet and length as before: codes look the same.

ALTER FUNCTION public.normalize_flux_school_code(text) SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.flux_parent_gen_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path = public, pg_temp
AS $f$
DECLARE
  chars CONSTANT text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  idx int[] := ARRAY[0, 1, 2, 3, 4, 5, 9, 10];
  out text := '';
  i int;
BEGIN
  FOREACH i IN ARRAY idx LOOP
    out := out || substr(chars, 1 + (get_byte(b, i) % 32), 1);
  END LOOP;
  RETURN out;
END;
$f$;
