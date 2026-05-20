-- P7-TESTS: E2E harness flag (Playwright smoke paths; no server-side test data).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_e2e_harness',
    'E2E test harness — ?e2e=1 guest/role bootstrap for Playwright (dev/CI only)',
    false,
    'platform'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
