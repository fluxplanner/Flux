-- Apps the owner has hidden from everyone else, until they choose to show them.
--
-- A row means "hidden"; deleting it shows the app again. Pair with
-- public/js/flux-app-visibility.js, which every Flux page loads first.
--
-- Why not flux_feature_flags: most Flux apps run signed out with no Supabase
-- library, and flux_resolve_feature_flags() returns nothing to a signed-out
-- visitor. Flags also let any user override their own value, which would let
-- a student turn a hidden app back on for themselves.
--
-- Anyone may read the list, because signed-out pages have to obey it. Only the
-- owner may change it, named by account id: the owner's email has changed
-- before and broke an email-based policy (20260926170000).
--
-- The planner is refused outright: hiding it would hide the sign-in page and
-- the owner control itself.

CREATE TABLE IF NOT EXISTS public.flux_hidden_apps (
  app_id    TEXT PRIMARY KEY
            CHECK (app_id ~ '^[a-z][a-z0-9_-]{0,39}$' AND app_id <> 'planner'),
  hidden_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flux_hidden_apps ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.flux_hidden_apps FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.flux_hidden_apps TO anon, authenticated;
GRANT INSERT, DELETE ON TABLE public.flux_hidden_apps TO authenticated;

DROP POLICY IF EXISTS "flux_hidden_apps_read" ON public.flux_hidden_apps;
CREATE POLICY "flux_hidden_apps_read" ON public.flux_hidden_apps
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "flux_hidden_apps_owner_insert" ON public.flux_hidden_apps;
CREATE POLICY "flux_hidden_apps_owner_insert" ON public.flux_hidden_apps
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = 'eabe2b1f-e428-4181-8530-8e5366eb3975'::uuid);

DROP POLICY IF EXISTS "flux_hidden_apps_owner_delete" ON public.flux_hidden_apps;
CREATE POLICY "flux_hidden_apps_owner_delete" ON public.flux_hidden_apps
  FOR DELETE TO authenticated
  USING (auth.uid() = 'eabe2b1f-e428-4181-8530-8e5366eb3975'::uuid);
