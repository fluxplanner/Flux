-- P8.8 IA East pilot — Staff Productivity Suite school overrides (reversible).
-- Applies to users whose user_roles.school = 'International Academy East'.
-- Gmail import stays off by default (separate flag + Google OAuth).

INSERT INTO public.flux_school_feature_flags (school_key, flag_key, enabled) VALUES
  ('International Academy East', 'enable_staff_productivity_suite', true),
  ('International Academy East', 'enable_classroom_tools', true),
  ('International Academy East', 'enable_caseload_engine', true),
  ('International Academy East', 'enable_personal_hub', true),
  ('International Academy East', 'enable_staff_command_v2', true),
  ('International Academy East', 'enable_school_ops', true)
ON CONFLICT (school_key, flag_key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  updated_at = NOW();
