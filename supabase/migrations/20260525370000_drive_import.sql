-- P6-DRIVE: Google Drive import → lesson / assignment generation (client-side API).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_drive_import', 'Google Drive import — generate lesson plans and assignment drafts from Drive files', false, 'integrations')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
