-- P13.7 Meeting / distraction collapse mode.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_meeting_mode',
    'Meeting mode: collapse distractions, banner timer, auto-reply copy',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
