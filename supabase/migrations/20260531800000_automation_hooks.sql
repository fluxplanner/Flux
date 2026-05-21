-- P20.1 Automation URL hooks — Shortcuts / ?quick= / ?panel= schemes.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_automation_hooks',
    'Documented URL hooks for Shortcuts and automations (?quick=focus, ?panel=calendar)',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
