-- Deploy hardening (applied to prod 2026-07-23 during the Phase-C rollout).
--
-- Supabase's default privileges auto-GRANT EXECUTE to `anon` on every new
-- function in the public schema. `REVOKE ALL ... FROM PUBLIC` (used in the
-- C3/C5/C8 migrations) does NOT strip that direct anon grant, so the three
-- teacher-only SECURITY DEFINER RPCs remained anon-executable. They already
-- return 'not_your_class' for anon (auth.uid() is NULL), so nothing leaked —
-- this is defense in depth to match the intended posture: teacher RPCs are
-- authenticated-only. flux_get_sub_plan intentionally keeps anon EXECUTE
-- (substitutes open share codes with no account).
--
-- Rollback: none needed (tightening only). To reverse:
--   GRANT EXECUTE ON FUNCTION public.flux_teacher_accommodation_chips(text) TO anon; (etc.)

REVOKE EXECUTE ON FUNCTION public.flux_teacher_accommodation_chips(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.flux_teacher_accommodation_details(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.flux_teacher_study_hall(text) FROM anon;
