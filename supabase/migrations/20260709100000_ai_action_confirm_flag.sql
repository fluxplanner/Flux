-- P0 A4 — register enable_ai_action_confirm in the feature-flag registry.
--
-- With this flag on, Flux AI tool calls that create/modify more than one item
-- (or modify existing items) render an in-chat proposal card the student must
-- Apply/Cancel; single creations auto-apply with an inline Undo chip; every
-- apply writes one undo group. Client default matches (false = off).
--
-- Rollback: DELETE FROM public.flux_feature_flags WHERE key = 'enable_ai_action_confirm';
INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_ai_action_confirm', 'Flux AI propose-then-confirm: bulk/modifying actions need Apply, with one-click Undo', false, 'student')
ON CONFLICT (key) DO NOTHING;
