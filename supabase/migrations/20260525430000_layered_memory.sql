-- P7-MEMORY: layered AI memory + reset-by-layer RPCs.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_layered_memory',
    'Layered AI memory (session / working / long-term) with user reset controls',
    false,
    'platform'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();

ALTER TABLE public.flux_user_memory
  ADD COLUMN IF NOT EXISTS layer TEXT NOT NULL DEFAULT 'longterm';

-- Migrate unique constraint to include layer (idempotent).
ALTER TABLE public.flux_user_memory
  DROP CONSTRAINT IF EXISTS flux_user_memory_user_id_type_key_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'flux_user_memory_user_layer_type_key_key'
  ) THEN
    ALTER TABLE public.flux_user_memory
      ADD CONSTRAINT flux_user_memory_user_layer_type_key_key
      UNIQUE (user_id, layer, type, key);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_flux_user_memory_user_layer
  ON public.flux_user_memory (user_id, layer);

CREATE TABLE IF NOT EXISTS public.flux_memory_reset_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  layers     TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flux_memory_reset_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flux_memory_reset_log_insert_own" ON public.flux_memory_reset_log;
CREATE POLICY "flux_memory_reset_log_insert_own" ON public.flux_memory_reset_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "flux_memory_reset_log_select_own" ON public.flux_memory_reset_log;
CREATE POLICY "flux_memory_reset_log_select_own" ON public.flux_memory_reset_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.flux_reset_user_memory(p_layers TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  cleaned TEXT[];
  lyr TEXT;
  deleted INT := 0;
  n INT;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_layers IS NULL OR array_length(p_layers, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_layers');
  END IF;

  FOREACH lyr IN ARRAY p_layers
  LOOP
    lyr := left(trim(lyr), 32);
    IF lyr = '' OR lyr NOT IN ('session', 'working', 'longterm', 'preferences') THEN
      CONTINUE;
    END IF;
    cleaned := array_append(cleaned, lyr);
    DELETE FROM public.flux_user_memory WHERE user_id = uid AND layer = lyr;
    GET DIAGNOSTICS n = ROW_COUNT;
    deleted := deleted + n;
  END LOOP;

  IF array_length(cleaned, 1) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_valid_layers');
  END IF;

  INSERT INTO public.flux_memory_reset_log (user_id, layers)
  VALUES (uid, cleaned);

  RETURN jsonb_build_object('ok', true, 'layers', cleaned, 'deleted', deleted);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_reset_user_memory(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_reset_user_memory(TEXT[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.flux_user_memory_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  stats JSONB;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT coalesce(jsonb_object_agg(layer, cnt), '{}'::jsonb)
  INTO stats
  FROM (
    SELECT layer, count(*)::int AS cnt
    FROM public.flux_user_memory
    WHERE user_id = uid
    GROUP BY layer
  ) s;

  RETURN jsonb_build_object('ok', true, 'by_layer', stats);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_user_memory_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_user_memory_stats() TO authenticated;
