-- P10.1 localStorage repair — scan and fix corrupt planner JSON blobs.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_storage_repair',
    'Settings → Data: scan and repair corrupt local planner JSON (tasks, notes, events, …)',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
