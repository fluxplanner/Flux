-- Phase 37.1 PR-C: promote IAE-validated pilot flags to global defaults.
-- School rows for International Academy East remain (idempotent); other schools can override off.

UPDATE public.flux_feature_flags
SET default_enabled = true, updated_at = NOW()
WHERE key IN (
  'enable_staff_productivity_suite',
  'enable_classroom_tools',
  'enable_caseload_engine',
  'enable_personal_hub',
  'enable_staff_command_v2',
  'enable_locale_foundation',
  'enable_syllabus_conflict_check'
);

-- Counselor caseload: IAE school override only (consent-gated; not global default).
INSERT INTO public.flux_school_feature_flags (school_key, flag_key, enabled) VALUES
  ('International Academy East', 'enable_counselor_caseload', true)
ON CONFLICT (school_key, flag_key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  updated_at = NOW();
