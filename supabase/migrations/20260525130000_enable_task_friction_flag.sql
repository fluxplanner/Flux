-- P2-FRICTION: feature flag for task aging + friction UI on cards.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_task_friction', 'Task friction tiers, aging badges, reschedule tracking on cards', false, 'student')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
