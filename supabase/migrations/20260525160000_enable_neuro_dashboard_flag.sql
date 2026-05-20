-- P2-NEURO-DASHBOARD: adaptive dashboard density (overload vs momentum modes).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_neuro_dashboard', 'Neuro-adaptive dashboard — recovery / focus / flow / balanced density', false, 'student')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
