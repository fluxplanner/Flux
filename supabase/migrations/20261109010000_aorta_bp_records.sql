-- Aorta blood pressure tracker: one copy of a family's tracker per Flux account.
--
-- aorta-tracker.html (The Aorta Project, a Flux partner) keeps everything on
-- the device and, when someone signs in with their Flux account, also here,
-- so every phone signed in to that account sees the same family.
-- Client: public/js/flux-aorta-vault.mjs.
--
-- data is the tracker's record: { v, people: [{ id, name, nameAt, meds,
-- doses, readings }], gone: [ids] }. It is health information stored as
-- plain jsonb, NOT end-to-end encrypted: row-level security keeps each row
-- to its owner, but anyone with database access can read it.
--
-- Access follows synara_vaults: nothing for anon, the four operations
-- signed-in people need, (select auth.uid()) evaluated once per query.

CREATE TABLE IF NOT EXISTS public.aorta_bp_records (
  user_id     UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  data        JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Years of twice-daily readings for a large family is well under 1 MB;
  -- 2 MB stops the table being used as free storage.
  CONSTRAINT aorta_bp_records_size CHECK (pg_column_size(data) <= 2000000),
  CONSTRAINT aorta_bp_records_shape CHECK (jsonb_typeof(data) = 'object' AND jsonb_typeof(data -> 'people') = 'array')
);

COMMENT ON TABLE public.aorta_bp_records IS 'Aorta blood pressure tracker: one family record per Flux account (aorta-tracker.html). Plain jsonb, owner-only by RLS.';

CREATE OR REPLACE FUNCTION public.aorta_bp_records_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aorta_bp_records_touch ON public.aorta_bp_records;
CREATE TRIGGER aorta_bp_records_touch
  BEFORE INSERT OR UPDATE ON public.aorta_bp_records
  FOR EACH ROW EXECUTE FUNCTION public.aorta_bp_records_touch();

ALTER TABLE public.aorta_bp_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.aorta_bp_records FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aorta_bp_records TO authenticated;

CREATE POLICY "aorta_bp_records_select_own"
  ON public.aorta_bp_records FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "aorta_bp_records_insert_own"
  ON public.aorta_bp_records FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "aorta_bp_records_update_own"
  ON public.aorta_bp_records FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "aorta_bp_records_delete_own"
  ON public.aorta_bp_records FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
