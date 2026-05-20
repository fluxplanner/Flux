-- P8-ERRORS: client error reporting (privacy-scrubbed, optional server persist via event bus).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_client_error_reporting',
    'Capture JS errors to local ring; persist client_error events when enable_event_bus is also on',
    false,
    'platform'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
