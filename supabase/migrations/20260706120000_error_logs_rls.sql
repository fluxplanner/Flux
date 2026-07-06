-- ════════════════════════════════════════════════════════════════════
-- FLUX PLANNER — error_logs RLS lockdown
-- public.error_logs (created in 20260425120000_billing_entitlements.sql)
-- was the one public table left without RLS. It holds user_id, stack
-- traces, URLs, plan and arbitrary context JSON — sensitive diagnostic
-- data. Supabase grants anon/authenticated default privileges on public
-- tables, so with RLS off any signed-in user could SELECT every row and
-- INSERT forged entries.
--
-- error_logs is written only by trusted server code (service_role, which
-- bypasses RLS) and is never read from the client. Enabling RLS with NO
-- permissive policy therefore denies all anon/authenticated access while
-- leaving service-role writes working — the correct locked-down posture.
-- Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Defense in depth: revoke the default table grants so the table is not
-- reachable by the client roles even if RLS is ever toggled off.
REVOKE ALL ON public.error_logs FROM anon, authenticated;
