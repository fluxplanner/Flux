-- P3-ROSTER: roster tab polish + optional pending join-by-code flow.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_teacher_roster_v2', 'Teacher roster v2 — class-scoped roster tab, copy code, pending join queue per class', false, 'teacher')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
