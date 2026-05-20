-- P3-TEACHER-DASH: class momentum overview cards (aggregates only).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_teacher_class_momentum', 'Teacher dashboard — class momentum overview cards (aggregate metrics)', false, 'teacher')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
