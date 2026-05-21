-- P19.1 Email-to-task inbox — staging queue for syllabus emails.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_email_task_inbox',
    'Stage syllabus/deadline emails for approval before creating tasks',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
