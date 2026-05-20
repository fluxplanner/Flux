-- P8-I18N — Locale + date formatting foundation (client-side).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_locale_foundation', 'Locale picker + Intl date/time formatting helpers (flux-i18n)', false, 'platform')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
