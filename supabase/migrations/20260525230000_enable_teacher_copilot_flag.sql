-- P3-TEACHER-COPILOT: class-scoped teacher copilot panel (separate from lesson generator flag).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_teacher_copilot', 'Teacher copilot — class-scoped AI side panel (aggregates only in context)', false, 'teacher')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
