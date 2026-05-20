-- P2-SRS: hardened spaced repetition scheduling + telemetry.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_srs_v2', 'SRS v2 — deduped review scheduling, card badges, telemetry', false, 'student')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
