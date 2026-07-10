-- C1 — register enable_now_engine in the feature-flag registry.
--
-- FluxNow (public/js/flux-now-engine.js): bell-aware strip under the top bar
-- (current period + minutes left + what's next), school-time line in the AI
-- planner context, and the single owner of "what's next" surfaces.
-- Client default matches (false = off).
--
-- Rollback: DELETE FROM public.flux_feature_flags WHERE key = 'enable_now_engine';
INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_now_engine', 'Bell-aware Now strip: current period, minutes left, what''s next; feeds AI context', false, 'student')
ON CONFLICT (key) DO NOTHING;
