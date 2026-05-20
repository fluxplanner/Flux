-- P6-DOCS: Google Docs ↔ Ghost draft bidirectional sync (client-side).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_docs_ghost_sync', 'Google Docs ↔ Ghost draft — push scaffold to Doc, pull edits back to task', false, 'integrations')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
