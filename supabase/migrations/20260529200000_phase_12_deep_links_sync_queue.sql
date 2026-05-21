-- Phase 12.1–12.2: deep links + sync queue UI flags.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_deep_links',
    'Entity deep links (?task= ?note= ?focus=) and copy-share URLs',
    false,
    'student'
  ),
  (
    'enable_sync_queue_ui',
    'Offline sync queue modal: pending writes, retry, per-key status',
    false,
    'platform'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
