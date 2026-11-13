-- People can see the roles they hold, and hear when they get a new one.
--
-- flux_my_roles(): the caller's own roles, with name, colour and what each
-- allows, for Settings › Account › Your roles. Still nothing about anyone
-- else's roles, and nothing about roles the caller does not hold.
--
-- Being given a role sends a pop-up through owner_direct_messages, the
-- owner's existing one-person message (flux-owner-messages.js shows it after
-- sign-in). A trigger rather than the Roles panel, so every way of adding a
-- member notifies, and a failed message never undoes the role.

CREATE OR REPLACE FUNCTION public.flux_my_roles()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name', r.name, 'color', r.color, 'permissions', to_jsonb(r.permissions), 'added_at', m.added_at
  ) ORDER BY m.added_at), '[]'::jsonb)
  FROM public.flux_role_members m
  JOIN public.flux_roles r ON r.id = m.role_id
  WHERE m.user_id = auth.uid();
$function$;

REVOKE ALL ON FUNCTION public.flux_my_roles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_my_roles() TO authenticated;

CREATE OR REPLACE FUNCTION public.flux_notify_role_given()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
BEGIN
  SELECT r.name INTO v_name FROM public.flux_roles r WHERE r.id = NEW.role_id;
  BEGIN
    INSERT INTO public.owner_direct_messages (recipient_id, title, body, created_by)
    VALUES (
      NEW.user_id,
      'You have a new role: ' || coalesce(v_name, 'a Flux role'),
      'The Flux owner gave you the "' || coalesce(v_name, 'new') || '" role. ' ||
      'See what it lets you do in Settings › Account › Your roles.',
      'roles'
    );
  EXCEPTION WHEN others THEN
    -- The role still counts if the message cannot be written.
    NULL;
  END;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.flux_notify_role_given() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS flux_notify_role_given ON public.flux_role_members;
CREATE TRIGGER flux_notify_role_given
  AFTER INSERT ON public.flux_role_members
  FOR EACH ROW EXECUTE FUNCTION public.flux_notify_role_given();
