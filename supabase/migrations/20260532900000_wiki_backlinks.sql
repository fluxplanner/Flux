-- P31.1 Wiki backlinks — [[wikilink]] parsing, backlinks panel, note graph.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_wiki_backlinks',
    'Obsidian-style [[wikilinks]] between notes with backlinks panel and graph overview',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
