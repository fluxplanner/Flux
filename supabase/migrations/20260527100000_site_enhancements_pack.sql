-- Site Enhancements Pack — 50 UX polish items (client module flux-site-enhancements.js)
INSERT INTO public.flux_feature_flags (key, description, default_enabled, category)
VALUES (
  'enable_site_enhancements_pack',
  'Ships 50 small UX/accessibility/productivity enhancements via FluxSiteEnhancements',
  true,
  'platform'
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
