-- The AI allowance counters are server-only, as they were always meant to be.
--
-- 20260514130000 wrote `REVOKE ALL ... FROM PUBLIC; GRANT ... TO service_role`
-- for check_and_increment_usage and refund_ai_usage. That does not do what it
-- reads as: Supabase's default privileges grant EXECUTE on every new public
-- function directly to anon and authenticated, and revoking PUBLIC leaves those
-- direct grants in place (the same trap 20260711160000 describes). So all
-- three counters stayed callable through /rest/v1/rpc by anyone holding the
-- public anon key, signed in or not:
--
--   * refund_ai_usage(own id), called in a loop, walks today's count back to
--     zero — unlimited AI requests on the project's paid provider keys.
--   * increment_ai_usage / check_and_increment_usage on someone else's id use
--     up their daily and monthly allowance, locking them out of AI.
--
-- None of them checks auth.uid(); they trust p_user_id because the only
-- intended caller is ai-proxy through supabase/functions/_shared/plan.ts,
-- which uses the service role. No page in the app calls them (checked: public/,
-- extension/, every edge function).
--
-- flux_resolve_user_district(p_uid) is tightened with them: it answers "which
-- district is this staff account in" for any id, and its only caller is
-- flux_district_rollup_metrics, a SECURITY DEFINER function that runs as the
-- owner and so is unaffected.
--
-- Rollback (restores the previous, wider grants):
--   GRANT EXECUTE ON FUNCTION public.refund_ai_usage(uuid) TO anon, authenticated;  (etc.)

REVOKE EXECUTE ON FUNCTION public.check_and_increment_usage(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_ai_usage(uuid, date, text)              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refund_ai_usage(uuid)                             FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.flux_resolve_user_district(uuid)                  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.check_and_increment_usage(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_ai_usage(uuid, date, text)              TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_ai_usage(uuid)                             TO service_role;
GRANT EXECUTE ON FUNCTION public.flux_resolve_user_district(uuid)                  TO service_role;
