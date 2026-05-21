-- P22.1 ICS timetable import — school schedule + blackout dates from .ics files.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_ics_timetable_import',
    'Import school timetables and blackout dates from ICS files in one step',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;

COMMENT ON TABLE public.flux_feature_flags IS 'Feature flags include enable_ics_timetable_import (P22.1).';
