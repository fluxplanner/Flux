-- Long-term Flux AI memory (preferences, weaknesses, habits, style) — optional client upserts
CREATE TABLE IF NOT EXISTS public.flux_user_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type, key)
);

CREATE INDEX IF NOT EXISTS idx_flux_user_memory_user_id ON public.flux_user_memory (user_id);

ALTER TABLE public.flux_user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flux_user_memory_select_own"
  ON public.flux_user_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "flux_user_memory_insert_own"
  ON public.flux_user_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "flux_user_memory_update_own"
  ON public.flux_user_memory FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "flux_user_memory_delete_own"
  ON public.flux_user_memory FOR DELETE
  USING (auth.uid() = user_id);
