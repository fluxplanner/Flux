-- Register enable_locale_ai_fallback in the feature-flag registry.
--
-- This flag was added to public/js/flux-feature-flags.js defaults() and is used
-- by public/js/flux-i18n-dom.js (as AI_FALLBACK_FLAG) but was never recorded in
-- a migration, which broke the flag-integrity CI check (client default with no
-- migration entry). default_enabled = true matches the existing client default,
-- so effective behavior is unchanged. Idempotent.
INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_locale_ai_fallback', 'Full-site translation: AI-batch + cache uncovered UI strings', true, 'platform')
ON CONFLICT (key) DO NOTHING;
