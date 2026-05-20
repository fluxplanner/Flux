-- P9.3 Enhanced sync conflict resolver (requires enable_offline_sync).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_sync_conflict_ui',
    'Sync conflict preview modal, bulk resolve, Settings entry (needs offline sync)',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
