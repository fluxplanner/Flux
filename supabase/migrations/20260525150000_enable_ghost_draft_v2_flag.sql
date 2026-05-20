-- P2-GHOST-DRAFT-V2: rubric-aware ghost scaffolding on task cards.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_ghost_draft_v2', 'Ghost draft v2 — rubric-aware AI scaffolding on task cards', false, 'student')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
