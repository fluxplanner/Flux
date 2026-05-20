-- P2-SHUTDOWN-V2: reflection + tomorrow preview shutdown flow.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_shutdown_v2', 'Daily shutdown v2 — reflection prompts + tomorrow preview', false, 'student')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
