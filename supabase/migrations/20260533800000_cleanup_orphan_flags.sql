-- Phase 37.1 PR-A: remove orphan feature flags (no client isEnabled references).
-- Reversible: re-insert rows from 20260524120000_feature_flags_foundation.sql if needed.

DELETE FROM public.flux_feature_flags
WHERE key IN ('enable_counselor_insights', 'enable_cognitive_predictions');

-- School/user rows cascade via flag_key FK ON DELETE CASCADE.
