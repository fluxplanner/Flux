-- P13.3 Bulk edit by task filter / smart list.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_bulk_filter',
    'Bulk select and edit all tasks in the current filter or smart list',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
