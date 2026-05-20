-- P8-PILOT-B: extend IA East school overrides — locale + admin ops health.

INSERT INTO public.flux_school_feature_flags (school_key, flag_key, enabled) VALUES
  ('International Academy East', 'enable_locale_foundation', true),
  ('International Academy East', 'enable_ops_health_panel', true)
ON CONFLICT (school_key, flag_key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  updated_at = NOW();
