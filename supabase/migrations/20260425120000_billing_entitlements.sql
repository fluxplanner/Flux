-- Flux Planner: subscriptions, AI usage, sync_versions, error_logs, signup trigger, increment_ai_usage RPC
-- Run order preserved as single migration file for repo; apply via Supabase CLI or SQL Editor.

-- Block 1 — Subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id        TEXT,
  plan                   TEXT NOT NULL DEFAULT 'free'
                           CHECK (plan IN ('free', 'pro', 'school')),
  status                 TEXT NOT NULL DEFAULT 'trialing'
                           CHECK (status IN (
                             'trialing', 'active', 'past_due',
                             'canceled', 'incomplete', 'incomplete_expired',
                             'unpaid', 'paused'
                           )),
  trial_start            TIMESTAMPTZ,
  trial_ends_at          TIMESTAMPTZ,
  current_period_start   TIMESTAMPTZ,
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT false,
  canceled_at            TIMESTAMPTZ,
  ended_at               TIMESTAMPTZ,
  payment_method_last4   TEXT,
  payment_method_brand   TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
  ON public.subscriptions (stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub
  ON public.subscriptions (stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
  ON public.subscriptions (user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Block 2 — AI usage
CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date           DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count  INTEGER NOT NULL DEFAULT 0,
  image_count    INTEGER NOT NULL DEFAULT 0,
  month_year     TEXT NOT NULL DEFAULT TO_CHAR(NOW(), 'YYYY-MM'),
  PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_month
  ON public.ai_usage (user_id, month_year);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_usage_select_own" ON public.ai_usage;
CREATE POLICY "ai_usage_select_own"
  ON public.ai_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.ai_usage FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ai_usage FROM anon;

-- Block 3 — Sync versions
CREATE TABLE IF NOT EXISTS public.sync_versions (
  user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  version         INTEGER NOT NULL DEFAULT 0,
  last_device_id  TEXT,
  last_synced_at  TIMESTAMPTZ DEFAULT NOW(),
  data_hash       TEXT
);

ALTER TABLE public.sync_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sync_versions_all_own" ON public.sync_versions;
CREATE POLICY "sync_versions_all_own"
  ON public.sync_versions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Block 4 — Error logs
CREATE TABLE IF NOT EXISTS public.error_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT,
  message      TEXT,
  stack        TEXT,
  url          TEXT,
  user_agent   TEXT,
  app_version  TEXT,
  plan         TEXT,
  context      JSONB,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Block 5 — Atomic AI increment (service role / Edge Functions)
CREATE OR REPLACE FUNCTION public.increment_ai_usage(
  p_user_id UUID,
  p_date DATE,
  p_month_year TEXT
) RETURNS void AS $$
BEGIN
  INSERT INTO public.ai_usage (user_id, date, month_year, message_count)
  VALUES (p_user_id, p_date, p_month_year, 1)
  ON CONFLICT (user_id, date)
  DO UPDATE SET message_count = public.ai_usage.message_count + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.increment_ai_usage(UUID, DATE, TEXT) TO service_role;

-- Block 6 — New user → subscription row (30-day trial metadata; plan stays free until Stripe upgrades)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.subscriptions (
    user_id,
    plan,
    status,
    trial_start,
    trial_ends_at
  ) VALUES (
    NEW.id,
    'free',
    'trialing',
    NOW(),
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
