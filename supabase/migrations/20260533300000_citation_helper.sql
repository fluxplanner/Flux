-- P35.1 Citation helper — saved MLA/APA/Chicago citations + bibliography export.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_citation_helper',
    'Citation builder with saved library, note insert, and bibliography export (MLA/APA/Chicago)',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
