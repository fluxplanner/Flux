-- P24.1 CS snippet library — local code snippets with tag search (no server table).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_cs_snippet_library',
    'Local CS code snippet library with syntax highlight and tag search in Toolbox',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
