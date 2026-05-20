-- P7-EVENT-BUS: server-side processor job queue + client drain RPCs.
-- Complements flux_product_events (P1). Flag: enable_event_bus_processors.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_event_bus_processors',
    'FluxBus event processors — local queue + server job drain (edge-worker stub)',
    false,
    'platform'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.flux_processor_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name   TEXT NOT NULL,
  payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  processor_id TEXT NOT NULL DEFAULT 'default',
  status       TEXT NOT NULL DEFAULT 'pending',
  attempts     INT NOT NULL DEFAULT 0,
  last_error   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at   TIMESTAMPTZ,
  finished_at  TIMESTAMPTZ,
  CONSTRAINT flux_processor_jobs_name_len CHECK (char_length(event_name) BETWEEN 1 AND 128),
  CONSTRAINT flux_processor_jobs_proc_len CHECK (char_length(processor_id) BETWEEN 1 AND 64),
  CONSTRAINT flux_processor_jobs_status_chk CHECK (status IN ('pending', 'claimed', 'done', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_flux_processor_jobs_user_pending
  ON public.flux_processor_jobs (user_id, created_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_flux_processor_jobs_status_created
  ON public.flux_processor_jobs (status, created_at DESC);

ALTER TABLE public.flux_processor_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flux_processor_jobs_select_own" ON public.flux_processor_jobs;
CREATE POLICY "flux_processor_jobs_select_own" ON public.flux_processor_jobs
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "flux_processor_jobs_admin_read" ON public.flux_processor_jobs;
CREATE POLICY "flux_processor_jobs_admin_read" ON public.flux_processor_jobs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Batch enqueue (client after local handlers). Max 10 jobs per call.
CREATE OR REPLACE FUNCTION public.flux_enqueue_processor_jobs(p_jobs JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  cnt INT;
  job JSONB;
  ename TEXT;
  proc_id TEXT;
  epayload JSONB;
  inserted INT := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_jobs IS NULL OR jsonb_typeof(p_jobs) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  cnt := jsonb_array_length(p_jobs);
  IF cnt < 1 OR cnt > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_size');
  END IF;

  FOR job IN SELECT * FROM jsonb_array_elements(p_jobs)
  LOOP
    ename := left(trim(coalesce(job->>'event_name', '')), 128);
    IF ename = '' THEN
      CONTINUE;
    END IF;
    proc_id := left(coalesce(nullif(trim(job->>'processor_id'), ''), 'default'), 64);
    epayload := coalesce(job->'payload', '{}'::jsonb);
    IF octet_length(epayload::text) > 4096 THEN
      epayload := jsonb_build_object('_truncated', true);
    END IF;

    INSERT INTO public.flux_processor_jobs (user_id, event_name, payload, processor_id, status)
    VALUES (uid, ename, epayload, proc_id, 'pending');
    inserted := inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'accepted', inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_enqueue_processor_jobs(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_enqueue_processor_jobs(JSONB) TO authenticated;

-- Claim pending jobs for the current user (client edge-worker drain).
CREATE OR REPLACE FUNCTION public.flux_claim_processor_jobs(p_limit INT DEFAULT 5)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  lim INT;
  claimed JSONB;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  lim := greatest(1, least(coalesce(p_limit, 5), 10));

  WITH picked AS (
    SELECT j.id
    FROM public.flux_processor_jobs j
    WHERE j.user_id = uid AND j.status = 'pending'
    ORDER BY j.created_at ASC
    LIMIT lim
    FOR UPDATE SKIP LOCKED
  ),
  updated AS (
    UPDATE public.flux_processor_jobs j
    SET status = 'claimed', claimed_at = NOW(), attempts = j.attempts + 1
    FROM picked
    WHERE j.id = picked.id
    RETURNING j.id, j.event_name, j.payload, j.processor_id, j.attempts, j.created_at
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', u.id,
    'event_name', u.event_name,
    'payload', u.payload,
    'processor_id', u.processor_id,
    'attempts', u.attempts,
    'created_at', u.created_at
  )), '[]'::jsonb)
  INTO claimed
  FROM updated u;

  RETURN jsonb_build_object('ok', true, 'jobs', claimed);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_claim_processor_jobs(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_claim_processor_jobs(INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.flux_complete_processor_job(
  p_job_id UUID,
  p_ok BOOLEAN DEFAULT true,
  p_error TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  row public.flux_processor_jobs%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO row
  FROM public.flux_processor_jobs
  WHERE id = p_job_id AND user_id = uid;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  IF row.status NOT IN ('claimed', 'pending') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_status');
  END IF;

  IF coalesce(p_ok, true) THEN
    UPDATE public.flux_processor_jobs
    SET status = 'done', finished_at = NOW(), last_error = NULL
    WHERE id = p_job_id;
    RETURN jsonb_build_object('ok', true, 'status', 'done');
  END IF;

  IF row.attempts >= 3 THEN
    UPDATE public.flux_processor_jobs
    SET
      status = 'failed',
      finished_at = NOW(),
      last_error = left(coalesce(p_error, 'processor_error'), 512)
    WHERE id = p_job_id;
    RETURN jsonb_build_object('ok', true, 'status', 'failed');
  END IF;

  UPDATE public.flux_processor_jobs
  SET
    status = 'pending',
    claimed_at = NULL,
    last_error = left(coalesce(p_error, 'processor_error'), 512)
  WHERE id = p_job_id;

  RETURN jsonb_build_object('ok', true, 'status', 'pending', 'retry', true);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_complete_processor_job(UUID, BOOLEAN, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_complete_processor_job(UUID, BOOLEAN, TEXT) TO authenticated;

-- Extend admin RLS health snapshot.
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
      'flux_product_events',
      'flux_processor_jobs'
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
