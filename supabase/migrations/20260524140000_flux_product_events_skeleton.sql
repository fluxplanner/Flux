-- P1-EVENTS-SKELETON: append-only product event store (not calendar localStorage flux_events).
-- Processors / queues deferred to P7-EVENT-BUS. Gated client-side by enable_event_bus.

CREATE TABLE IF NOT EXISTS public.flux_product_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name  TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  school_key  TEXT,
  source      TEXT NOT NULL DEFAULT 'client',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT flux_product_events_name_len CHECK (char_length(event_name) BETWEEN 1 AND 128),
  CONSTRAINT flux_product_events_source_len CHECK (char_length(source) BETWEEN 1 AND 32)
);

CREATE INDEX IF NOT EXISTS idx_flux_product_events_user_created
  ON public.flux_product_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_flux_product_events_name_created
  ON public.flux_product_events (event_name, created_at DESC);

ALTER TABLE public.flux_product_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flux_product_events_insert_own" ON public.flux_product_events;
CREATE POLICY "flux_product_events_insert_own" ON public.flux_product_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "flux_product_events_select_own" ON public.flux_product_events;
CREATE POLICY "flux_product_events_select_own" ON public.flux_product_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "flux_product_events_admin_read" ON public.flux_product_events;
CREATE POLICY "flux_product_events_admin_read" ON public.flux_product_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Batch insert (client flush); no processors in this migration.
CREATE OR REPLACE FUNCTION public.flux_record_product_events(p_events JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  school TEXT;
  cnt INT;
  ev JSONB;
  ename TEXT;
  epayload JSONB;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  cnt := jsonb_array_length(p_events);
  IF cnt < 1 OR cnt > 25 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_size');
  END IF;

  SELECT NULLIF(trim(ur.school), '') INTO school
  FROM public.user_roles ur
  WHERE ur.user_id = uid;

  FOR ev IN SELECT * FROM jsonb_array_elements(p_events)
  LOOP
    ename := left(trim(coalesce(ev->>'event_name', '')), 128);
    IF ename = '' THEN
      CONTINUE;
    END IF;
    epayload := coalesce(ev->'payload', '{}'::jsonb);
    IF octet_length(epayload::text) > 8192 THEN
      epayload := jsonb_build_object('_truncated', true);
    END IF;

    INSERT INTO public.flux_product_events (user_id, event_name, payload, school_key, source)
    VALUES (
      uid,
      ename,
      epayload,
      school,
      left(coalesce(nullif(trim(ev->>'source'), ''), 'client'), 32)
    );
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'accepted', cnt);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_record_product_events(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_record_product_events(JSONB) TO authenticated;

-- Extend admin RLS health snapshot to include product events table.
CREATE OR REPLACE FUNCTION public.flux_rls_health_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  is_admin BOOLEAN;
  policies JSONB;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = uid AND ur.role = 'admin'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'table', tablename,
    'policy', policyname,
    'cmd', cmd
  ) ORDER BY tablename, policyname), '[]'::jsonb)
  INTO policies
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'user_roles',
      'teacher_classes',
      'teacher_assignments',
      'teacher_students',
      'student_class_codes',
      'student_completions',
      'flux_feature_flags',
      'flux_product_events'
    );

  RETURN jsonb_build_object(
    'ok', true,
    'checked_at', NOW(),
    'legacy_roles_select_educators', EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'user_roles'
        AND policyname = 'roles_select_educators'
    ),
    'legacy_classes_teacher_all', EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'teacher_classes'
        AND policyname = 'classes_teacher_all'
    ),
    'policies', policies
  );
END;
$$;
