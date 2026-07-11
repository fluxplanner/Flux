-- C9 — register enable_seasons in the feature-flag registry.
--
-- Seasons & Streak Cosmetics (public/js/flux-seasons.js): healthy behaviors
-- (focus sessions, shutdown ritual, honoring quiet hours, group focus) earn
-- seasonal accents/confetti. Rest days auto-freeze streaks; rewards are
-- never grades-based. Data is localStorage-only (flux_seasons_v1) — no
-- tables. Client default matches (false = off).
--
-- Rollback: DELETE FROM public.flux_feature_flags WHERE key = 'enable_seasons';
INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_seasons', 'Seasonal cosmetics earned by healthy habits; rest-day streak freeze; never grades-based', false, 'student')
ON CONFLICT (key) DO NOTHING;
