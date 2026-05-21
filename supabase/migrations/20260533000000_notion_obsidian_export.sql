-- P32.1 Notion / Obsidian export — Markdown + YAML front matter for notes vault.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_notion_obsidian_export',
    'Export Flux notes as Obsidian-ready Markdown (YAML front matter) or ZIP vault; paste-friendly for Notion',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
