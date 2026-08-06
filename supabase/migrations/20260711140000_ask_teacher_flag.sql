-- C10 — register enable_ask_teacher in the feature-flag registry.
--
-- Ask-Your-Teacher Handoff (public/js/flux-ask-teacher.js): task-linked
-- "Ask my teacher" context card (student-editable before send) delivered
-- through the EXISTING flux_threads/flux_messages pipeline (participant-
-- only RLS — no new tables), plus a teacher triage queue in Lesson Hub.
-- Client-side rate limit 3/day. Client default matches (false = off).
--
-- Rollback: DELETE FROM public.flux_feature_flags WHERE key = 'enable_ask_teacher';
INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_ask_teacher', 'Ask-my-teacher handoff: task context card into staff messaging + Lesson Hub triage queue', false, 'student')
ON CONFLICT (key) DO NOTHING;
