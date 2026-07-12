-- OriginKit motion primitives — register enable_originkit_motion.
--
-- Subtle, CSS-first motion (border beam, tilt, shimmer text, stagger,
-- breathing glow, spotlight, magnet, spring count-up) ported into FluxAnim.
-- DEFAULT ON — these are micro-interactions, and reduced-motion /
-- data-flux-perf=on / data-flux-lowend are hard client-side kill switches
-- regardless of this flag. A district can force it off fleet-wide via
-- flux_school_feature_flags. No tables; localStorage-free.
--
-- Rollback: DELETE FROM public.flux_feature_flags WHERE key = 'enable_originkit_motion';
INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_originkit_motion', 'OriginKit-ported motion primitives (subtle; reduced-motion/perf/lowend hard-disable)', true, 'student')
ON CONFLICT (key) DO NOTHING;
