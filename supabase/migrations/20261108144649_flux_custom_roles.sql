-- Custom roles, made and handed out by the owner only (Owner Controls → Roles).
--
-- A role is a name, a colour and a list of permissions. Holding a role gives a
-- person every permission on it, the way Discord roles add up. Today the only
-- permissions are "app:<id>": see that app even while it is hidden from
-- everyone else (flux_hidden_apps). That is how a partner previews their own
-- app before it is public.
--
-- These are separate from user_roles (student / teacher / admin), which decide
-- what kind of account someone has. Nothing here can make anyone an admin.
--
-- Only the owner may read or change roles and members. A member may read their
-- own permissions through flux_my_permissions(), and nothing else: the names of
-- roles and who else holds them stay private.

CREATE OR REPLACE FUNCTION public.flux_valid_permissions(p text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT coalesce(bool_and(x ~ '^app:[a-z][a-z0-9_-]{0,39}$'), true)
  FROM unnest(p) AS x;
$function$;

CREATE TABLE IF NOT EXISTS public.flux_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 40),
  color       TEXT NOT NULL DEFAULT '#7c5cff' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  permissions TEXT[] NOT NULL DEFAULT '{}' CHECK (public.flux_valid_permissions(permissions)),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.flux_role_members (
  role_id  UUID NOT NULL REFERENCES public.flux_roles(id) ON DELETE CASCADE,
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, user_id)
);
CREATE INDEX IF NOT EXISTS flux_role_members_user_idx ON public.flux_role_members (user_id);

ALTER TABLE public.flux_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flux_role_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.flux_roles, public.flux_role_members FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.flux_roles TO authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.flux_role_members TO authenticated;

DROP POLICY IF EXISTS flux_roles_owner_all ON public.flux_roles;
CREATE POLICY flux_roles_owner_all ON public.flux_roles
  FOR ALL TO authenticated
  USING (public.flux_is_platform_admin())
  WITH CHECK (public.flux_is_platform_admin());

DROP POLICY IF EXISTS flux_role_members_owner_all ON public.flux_role_members;
CREATE POLICY flux_role_members_owner_all ON public.flux_role_members
  FOR ALL TO authenticated
  USING (public.flux_is_platform_admin())
  WITH CHECK (public.flux_is_platform_admin());

-- Every permission the caller holds, through all their roles.
CREATE OR REPLACE FUNCTION public.flux_my_permissions()
RETURNS text[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(array_agg(DISTINCT p ORDER BY p), '{}')
  FROM public.flux_role_members m
  JOIN public.flux_roles r ON r.id = m.role_id
  CROSS JOIN LATERAL unnest(r.permissions) AS p
  WHERE m.user_id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.flux_my_permissions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_my_permissions() TO authenticated;

-- Roles with their members' usernames, for the owner's editor.
CREATE OR REPLACE FUNCTION public.flux_owner_roles()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'id', r.id, 'name', r.name, 'color', r.color, 'permissions', to_jsonb(r.permissions),
      'members', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'user_id', m.user_id,
          'username', regexp_replace(coalesce(u.email, ''), '@users\.fluxplanner\.app$', '')
        ) ORDER BY m.added_at)
        FROM public.flux_role_members m
        JOIN auth.users u ON u.id = m.user_id
        WHERE m.role_id = r.id
      ), '[]'::jsonb)
    ) ORDER BY r.created_at)
    FROM public.flux_roles r
  ), '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.flux_owner_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_owner_roles() TO authenticated;
