-- P4-ALERTS: counselor outreach queue (non-diagnostic engagement signals).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_counselor_risk_queue', 'Counselor outreach queue — engagement signals from caseload + wellness snapshots (consent-gated)', false, 'counselor')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
