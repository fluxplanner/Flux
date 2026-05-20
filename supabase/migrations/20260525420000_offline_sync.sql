-- P7-OFFLINE: offline-first sync — conflict audit log (client merge is primary).

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_offline_sync',
    'Offline-first sync — outbox, LWW merge, conflict resolution UI',
    false,
    'platform'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS public.flux_sync_conflict_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  resolution   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ,
  CONSTRAINT flux_sync_conflict_type_len CHECK (char_length(entity_type) BETWEEN 1 AND 32),
  CONSTRAINT flux_sync_conflict_id_len CHECK (char_length(entity_id) BETWEEN 1 AND 64)
);

CREATE INDEX IF NOT EXISTS idx_flux_sync_conflict_log_user_open
  ON public.flux_sync_conflict_log (user_id, created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.flux_sync_conflict_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flux_sync_conflict_log_insert_own" ON public.flux_sync_conflict_log;
CREATE POLICY "flux_sync_conflict_log_insert_own" ON public.flux_sync_conflict_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "flux_sync_conflict_log_select_own" ON public.flux_sync_conflict_log;
CREATE POLICY "flux_sync_conflict_log_select_own" ON public.flux_sync_conflict_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "flux_sync_conflict_log_update_own" ON public.flux_sync_conflict_log;
CREATE POLICY "flux_sync_conflict_log_update_own" ON public.flux_sync_conflict_log
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.flux_record_sync_conflicts(p_rows JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  cnt INT;
  row JSONB;
  etype TEXT;
  eid TEXT;
  inserted INT := 0;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  cnt := jsonb_array_length(p_rows);
  IF cnt < 1 OR cnt > 10 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'batch_size');
  END IF;

  FOR row IN SELECT * FROM jsonb_array_elements(p_rows)
  LOOP
    etype := left(trim(coalesce(row->>'entity_type', '')), 32);
    eid := left(trim(coalesce(row->>'entity_id', '')), 64);
    IF etype = '' OR eid = '' THEN
      CONTINUE;
    END IF;

    INSERT INTO public.flux_sync_conflict_log (user_id, entity_type, entity_id)
    VALUES (uid, etype, eid);
    inserted := inserted + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'accepted', inserted);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_record_sync_conflicts(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_record_sync_conflicts(JSONB) TO authenticated;
