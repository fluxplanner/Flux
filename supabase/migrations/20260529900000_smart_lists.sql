-- P13.2 Smart task lists (preset filters).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_smart_lists',
    'Preset smart task lists: overdue STEM, no estimate, exam prep',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
