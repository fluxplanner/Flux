-- C4 — register enable_grade_gps in the feature-flag registry.
--
-- Grade GPS (public/js/flux-grade-gps.js): per-class trajectory sparkline
-- (daily Canvas snapshots + manual entries), user-editable category weights
-- (syllabus-photo extraction with review/confirm), and "Protect my A" study
-- blocks proposed through the A4 confirmation card. Data is localStorage-only
-- (flux_grade_gps_v1) — no tables. Client default matches (false = off).
--
-- Rollback: DELETE FROM public.flux_feature_flags WHERE key = 'enable_grade_gps';
INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_grade_gps', 'Grade GPS: per-class trajectory, category weights, protect-my-target study plan', false, 'student')
ON CONFLICT (key) DO NOTHING;
