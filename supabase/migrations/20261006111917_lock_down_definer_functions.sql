-- Lock down SECURITY DEFINER functions in public (Supabase advisor lints
-- 0028 / 0029). Applied to the FluxPlanner project on 2026-10-06.
--
-- Before: all 34 SECURITY DEFINER functions in public were executable by
-- anon through PUBLIC's default EXECUTE grant, which also undid the
-- 2026-07-24 hardening (harden_definer_grants_revoke_anon) for functions
-- added since. Most return 'not_authenticated' to anon, but three did not
-- check: flux_lookup_class_by_code, get_booked_slots, and the trigger
-- function handle_new_user.
--
-- For each SECURITY DEFINER function in public:
--   * EXECUTE is revoked from PUBLIC and anon;
--   * signed-in users (authenticated) keep exactly the access they had,
--     now as an explicit grant rather than through PUBLIC;
--   * service_role is granted explicitly;
--   * trigger functions (handle_new_user) are revoked from authenticated
--     too: triggers fire without the caller needing EXECUTE (checked with a
--     rolled-back probe before applying).
-- One deliberate exception: flux_get_sub_plan stays callable by anon, so a
-- substitute without a Flux account can open a shared sub plan by its code.
--
-- After: anon can execute 1 of 46 (flux_get_sub_plan); authenticated 40,
-- the same set as before minus handle_new_user; service_role all 46.
--
-- NEW FUNCTIONS: PUBLIC still gets EXECUTE by default (changing the global
-- default would also strip extension functions), so every new SECURITY
-- DEFINER function in public needs, in the same migration:
--   REVOKE EXECUTE ON FUNCTION public.fn(...) FROM PUBLIC, anon;
--   GRANT EXECUTE ON FUNCTION public.fn(...) TO authenticated;  -- if the app calls it
DO $$
DECLARE
  f record;
  had_auth boolean;
BEGIN
  FOR f IN
    SELECT p.oid, p.oid::regprocedure AS sig, p.prorettype = 'trigger'::regtype AS is_trigger
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    had_auth := has_function_privilege('authenticated', f.oid, 'EXECUTE');
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
    IF f.is_trigger THEN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', f.sig);
    ELSIF had_auth THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f.sig);
    END IF;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.flux_get_sub_plan(text) TO anon;
