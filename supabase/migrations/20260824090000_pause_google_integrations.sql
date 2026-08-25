-- Google integrations paused.
--
-- Gmail, Drive, Docs, Classroom and Calendar sync are hidden behind a single
-- flag rather than deleted. They added a great deal of surface area, and a
-- Google account had drifted into being an implied requirement for getting
-- value out of Flux — a student without one saw features advertised
-- everywhere that they could not use.
--
-- With this off the Canvas tab is Canvas only, the Settings "Google & Canvas"
-- and "Google Docs (study sync)" cards are hidden, and nothing in the product
-- promises Google. Canvas itself is unaffected: its connection lives in the
-- Canvas tab, not in those cards.
--
-- Turning the flag on restores every pane exactly as it was. Nothing here is
-- destructive — this is a pause, not a removal.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_google_integrations',
    'Google integrations (Gmail, Drive, Docs, Classroom, Calendar sync). Off: the Canvas tab is Canvas only and Google surfaces are hidden.',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
