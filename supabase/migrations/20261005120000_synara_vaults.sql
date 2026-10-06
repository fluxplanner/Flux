-- Synara sync: one encrypted copy of a student's Synara record per Flux account.
--
-- Synara (synara.html) is a health app: medication, seizures, emergency
-- contacts. It is encrypted on the student's device with AES-GCM before it is
-- sent, using a key that never leaves their devices (they carry it between
-- devices as a "sync key"). This table only ever holds ciphertext. Flux can
-- see that a row exists, its size and when it changed — not what is in it.
-- See docs/SYNARA-PARTNERSHIP.md.
--
-- Applied to the FluxPlanner project on 2026-10-06 as migration "synara_vaults".
--
-- Access follows the newest tables here (flux_password_help): nothing for
-- anon, only the four operations signed-in students need, policies scoped
-- to authenticated, and (select auth.uid()) so it is evaluated once per query.

CREATE TABLE IF NOT EXISTS public.synara_vaults (
  user_id     UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  ciphertext  TEXT NOT NULL,          -- base64 AES-GCM output of the whole record
  iv          TEXT NOT NULL,          -- base64 12-byte nonce, fresh for every write
  version     INT  NOT NULL DEFAULT 1,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A Synara record is tens of kilobytes; 2 MB is generous and stops the
  -- table being used as free storage.
  CONSTRAINT synara_vaults_size CHECK (length(ciphertext) <= 2000000),
  CONSTRAINT synara_vaults_iv   CHECK (length(iv) BETWEEN 12 AND 32)
);

COMMENT ON TABLE public.synara_vaults IS 'Synara sync: one end-to-end encrypted copy of a student''s Synara record per account. Ciphertext only; the key never leaves the student''s devices. See docs/SYNARA-PARTNERSHIP.md.';

-- The server sets the time, so a device's clock cannot fake "newer".
CREATE OR REPLACE FUNCTION public.synara_vaults_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS synara_vaults_touch ON public.synara_vaults;
CREATE TRIGGER synara_vaults_touch
  BEFORE INSERT OR UPDATE ON public.synara_vaults
  FOR EACH ROW EXECUTE FUNCTION public.synara_vaults_touch();

ALTER TABLE public.synara_vaults ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.synara_vaults FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.synara_vaults TO authenticated;

CREATE POLICY "synara_vaults_select_own"
  ON public.synara_vaults FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "synara_vaults_insert_own"
  ON public.synara_vaults FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "synara_vaults_update_own"
  ON public.synara_vaults FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "synara_vaults_delete_own"
  ON public.synara_vaults FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
