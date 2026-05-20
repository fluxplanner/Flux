-- P2-PREDICT: read-only predictive insights (gap-fill, deadline risk, overload week).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_predict_v2', 'Predictive insights v2 — read-only gap-fill, risk, overload hints', false, 'intelligence')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
