-- Platform-admin identity must survive an email change.
--
-- flux_is_platform_admin() matches auth.jwt() ->> 'email' against
-- platform_admins.email. That was fine while everyone signed in with Google,
-- but accounts are moving to name + password, where the stored address is a
-- synthesised one (<name>@FLUX_USER_DOMAIN). The moment the owner's address
-- changes, the function returns false, every owner-only policy shuts him out
-- of his own install, and there is no way back in through the app — the
-- Control tab is gated on the same answer.
--
-- Fix: key on the user id, which never changes. The email match stays as a
-- fallback so nothing breaks in the window before the accounts are migrated,
-- and so a brand-new admin can still be added by email alone.
--
-- This also closes an existing footgun. The old expression compared
-- lower(trim(pa.email)) against coalesce(auth.jwt() ->> 'email', ''), so a
-- platform_admins row with a blank email would have matched every caller whose
-- JWT carries no email at all. No such row exists today; now one is harmless.
--
-- Rollback:
--   CREATE OR REPLACE FUNCTION public.flux_is_platform_admin()
--   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
--   AS $$ SELECT EXISTS (SELECT 1 FROM public.platform_admins pa
--          WHERE lower(trim(pa.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))); $$;
--   DROP INDEX IF EXISTS public.platform_admins_user_id_key;
--   ALTER TABLE public.platform_admins DROP COLUMN IF EXISTS user_id;

ALTER TABLE public.platform_admins
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Partial, so the column can stay nullable: an admin may be listed by email
-- before that person has ever signed in and has a row in auth.users.
CREATE UNIQUE INDEX IF NOT EXISTS platform_admins_user_id_key
  ON public.platform_admins (user_id)
  WHERE user_id IS NOT NULL;

UPDATE public.platform_admins pa
SET user_id = u.id
FROM auth.users u
WHERE pa.user_id IS NULL
  AND lower(btrim(u.email)) = lower(btrim(pa.email));

CREATE OR REPLACE FUNCTION public.flux_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins pa
    WHERE pa.user_id = auth.uid()
       OR (
            nullif(btrim(pa.email), '') IS NOT NULL
            AND lower(btrim(pa.email))
                = lower(btrim(nullif(coalesce(auth.jwt() ->> 'email', ''), '')))
          )
  );
$$;

-- anon must not be able to probe who the admins are.
REVOKE ALL ON FUNCTION public.flux_is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_is_platform_admin() TO authenticated;
