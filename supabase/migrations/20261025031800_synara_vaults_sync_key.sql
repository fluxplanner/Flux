-- Synara sync, option 2 (chosen by the owner, 2026-10-25): keep the record's
-- sync key in the student's own row, so any device signed in to their Flux
-- account syncs without the student carrying a 26-character key.
--
-- Trade-off, accepted deliberately: RLS still limits each row to its owner,
-- but anyone with database access (service role, dashboard, a leaked backup)
-- can now decrypt the record. It is no longer end-to-end encrypted.
--
-- Applied to the FluxPlanner project on 2026-10-25 as migration
-- "synara_vaults_sync_key".

ALTER TABLE public.synara_vaults ADD COLUMN IF NOT EXISTS sync_key TEXT;
ALTER TABLE public.synara_vaults DROP CONSTRAINT IF EXISTS synara_vaults_sync_key_len;
ALTER TABLE public.synara_vaults ADD CONSTRAINT synara_vaults_sync_key_len CHECK (sync_key IS NULL OR length(sync_key) = 26);
COMMENT ON COLUMN public.synara_vaults.sync_key IS 'The record''s sync key, kept in the account so a signed-in device syncs without the student carrying the key. Readable only by the row''s owner (RLS) and by anyone with database access.';
