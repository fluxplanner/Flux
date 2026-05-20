-- P6-GMAIL: educator Gmail → task import (client-side Gmail API).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_gmail_educator_import', 'Educator Gmail inbox → smart task import (due-date parsing, dedupe)', false, 'educator')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
