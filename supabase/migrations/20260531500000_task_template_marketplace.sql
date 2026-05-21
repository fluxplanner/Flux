-- P17.1 Task template marketplace — curated multi-task packs.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_task_template_marketplace',
    'Curated task template packs (AP, SAT, college apps) with JSON import',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
