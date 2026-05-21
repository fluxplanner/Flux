-- P21.1 iCal subscribe feed — tokenized calendar export for Apple/Google subscribe.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_ical_subscribe',
    'Subscribe URL for due dates and focus blocks in Apple/Google Calendar',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;

CREATE TABLE IF NOT EXISTS public.flux_ical_feeds (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  ics_body text NOT NULL DEFAULT '',
  include_focus boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flux_ical_feeds_token_idx ON public.flux_ical_feeds (token);

ALTER TABLE public.flux_ical_feeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS flux_ical_feeds_own ON public.flux_ical_feeds;
CREATE POLICY flux_ical_feeds_own ON public.flux_ical_feeds
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.flux_ical_feeds IS 'Per-user ICS snapshot for public subscribe URL (token lookup via Edge Function only).';
