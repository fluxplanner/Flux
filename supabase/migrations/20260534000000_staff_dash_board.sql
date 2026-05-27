-- Educator personal dashboard: draggable widget board (mini cal, week view, photos, hub modules)
INSERT INTO flux_feature_flags (key, description, default_enabled, audience)
VALUES (
  'enable_staff_dash_board',
  'Educator personal dashboard widget board — drag, resize, add/remove widgets',
  false,
  'staff'
)
ON CONFLICT (key) DO NOTHING;
