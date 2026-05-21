-- P29.1 LaTeX live preview — KaTeX split pane for math-heavy notes.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_latex_live_preview',
    'Live KaTeX preview split pane in the note editor ($...$ and $$...$$ delimiters)',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
