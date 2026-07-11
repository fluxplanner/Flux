-- C7 — Chromebook-grade PWA push (flag enable_web_push).
--
-- Standard Web Push subscriptions (VAPID). Users opt in from
-- Settings → Alerts; the notify-push edge function (scheduler) sends
-- due-soon reminders, enforcing quiet hours + panic-mode settings
-- SERVER-SIDE from the user's planner blob so a stale client can't
-- cause a 2am buzz.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.push_subscriptions;
--   DELETE FROM public.flux_feature_flags WHERE key = 'enable_web_push';

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint   TEXT UNIQUE NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_ok_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Owner-only: users manage their own device subscriptions. The sender runs
-- with the service role.
DROP POLICY IF EXISTS "push_subscriptions_owner_all" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_owner_all" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_web_push', 'Web Push due-soon reminders (quiet-hours + panic aware, server-enforced)', false, 'student')
ON CONFLICT (key) DO NOTHING;
