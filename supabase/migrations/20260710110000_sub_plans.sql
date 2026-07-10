-- C3 — Sub-Plan Generator (flag enable_sub_plans).
--
-- One click in Lesson Hub renders today's bell-by-bell plan as a printable
-- page and (optionally) publishes it under an unguessable share code a
-- substitute can open READ-ONLY with no account. Codes expire in 48h and
-- every view writes an audit row.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.flux_get_sub_plan(text);
--   DROP TABLE IF EXISTS public.flux_sub_plan_views;
--   DROP TABLE IF EXISTS public.flux_sub_plans;
--   DELETE FROM public.flux_feature_flags WHERE key = 'enable_sub_plans';

CREATE TABLE IF NOT EXISTS public.flux_sub_plans (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}',
  code       TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sub_plans_teacher ON public.flux_sub_plans(teacher_id, date DESC);

CREATE TABLE IF NOT EXISTS public.flux_sub_plan_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sub_plan_id UUID NOT NULL REFERENCES public.flux_sub_plans(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  viewer_hint TEXT
);
CREATE INDEX IF NOT EXISTS idx_sub_plan_views_plan ON public.flux_sub_plan_views(sub_plan_id, viewed_at DESC);

ALTER TABLE public.flux_sub_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flux_sub_plan_views ENABLE ROW LEVEL SECURITY;

-- Owner-only CRUD on plans. NO public select policy — anonymous access goes
-- exclusively through the code-keyed RPC below.
DROP POLICY IF EXISTS "sub_plans_owner_all" ON public.flux_sub_plans;
CREATE POLICY "sub_plans_owner_all" ON public.flux_sub_plans
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

-- Owners can read the audit trail of their own plans. Inserts happen only
-- inside the SECURITY DEFINER RPC.
DROP POLICY IF EXISTS "sub_plan_views_owner_select" ON public.flux_sub_plan_views;
CREATE POLICY "sub_plan_views_owner_select" ON public.flux_sub_plan_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.flux_sub_plans p
      WHERE p.id = flux_sub_plan_views.sub_plan_id AND p.teacher_id = auth.uid()
    )
  );

-- Public read by unguessable code; expires; audits every view.
CREATE OR REPLACE FUNCTION public.flux_get_sub_plan(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  plan RECORD;
BEGIN
  SELECT id, date, payload, expires_at
  INTO plan
  FROM flux_sub_plans
  WHERE code = trim(p_code)
    AND length(trim(p_code)) >= 10
  LIMIT 1;

  IF plan.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF plan.expires_at < NOW() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'expired');
  END IF;

  INSERT INTO flux_sub_plan_views (sub_plan_id, viewer_hint)
  VALUES (plan.id, left(coalesce(current_setting('request.headers', true)::jsonb->>'user-agent', ''), 120));

  RETURN jsonb_build_object('ok', true, 'date', plan.date, 'payload', plan.payload);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_get_sub_plan(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_get_sub_plan(text) TO anon, authenticated;

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_sub_plans', 'Sub-Plan Generator: printable bell-by-bell plan + expiring read-only share code', false, 'educator')
ON CONFLICT (key) DO NOTHING;
