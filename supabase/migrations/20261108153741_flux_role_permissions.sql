-- More things a role can allow (Owner Controls → Roles).
--
--   apps:all          see every hidden app
--   app:<id>          see that one app while it is hidden
--   tabs:all          see every planner tab the owner hid (Planner tabs)
--   tab:<id>          see that one planner tab
--   site:maintenance  keep using and saving to Flux during maintenance
--   site:read_only    keep saving while Flux is read-only
--   posting:lockdown  post while posting is paused across Flux
--   posting:slow      skip a slow-down the owner set on this account
--   perk:tester       tester mode: Pro features and the tester badge
--
-- Apps and tabs are hidden by the pages themselves (flux-app-visibility.js,
-- flux-platform-ui.js). Site mode and posting are enforced here, in the
-- database. A mute is never lifted by a role: it is aimed at one person.

CREATE OR REPLACE FUNCTION public.flux_valid_permissions(p text[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT coalesce(bool_and(x ~ '^(app:[a-z][a-z0-9_-]{0,39}|apps:all|tab:[a-zA-Z][a-zA-Z0-9_-]{0,39}|tabs:all|site:(maintenance|read_only)|posting:(lockdown|slow)|perk:tester)$'), true)
  FROM unnest(p) AS x;
$function$;

-- Does the caller hold this permission through any role?
CREATE OR REPLACE FUNCTION public.flux_has_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.flux_role_members m
    JOIN public.flux_roles r ON r.id = m.role_id
    WHERE m.user_id = auth.uid() AND p_permission = ANY (r.permissions)
  );
$function$;

REVOKE ALL ON FUNCTION public.flux_has_permission(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_has_permission(text) TO authenticated, service_role;

-- Read-only and maintenance stop saving, except for roles allowed through.
-- Only reached on writes (flux_check_request, posting rules), so the extra
-- lookup does not touch reads.
CREATE OR REPLACE FUNCTION public.flux_site_read_only()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce((
    SELECT (s.value->>'mode' = 'read_only' AND NOT public.flux_has_permission('site:read_only'))
        OR (s.value->>'mode' = 'maintenance'
            AND coalesce((s.value->>'starts_at')::timestamptz, '-infinity') <= now()
            AND coalesce((s.value->>'ends_at')::timestamptz, 'infinity') > now()
            AND NOT public.flux_has_permission('site:maintenance'))
    FROM public.platform_settings s WHERE s.key = 'site_mode'
  ), false);
$function$;

-- The live posting rules, with posting:lockdown and posting:slow honoured.
CREATE OR REPLACE FUNCTION public.flux_enforce_posting_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_locked boolean := false;
  v_read_only boolean := false;
  v_muted boolean := false;
  v_wait integer;
  v_too_soon boolean := false;
BEGIN
  BEGIN
    IF v_uid IS NULL OR public.flux_is_platform_admin() THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'likes_count') = (to_jsonb(OLD) - 'likes_count') THEN
      RETURN NEW;
    END IF;
    SELECT coalesce((s.value->>'on')::boolean, false) INTO v_locked
      FROM public.platform_settings s WHERE s.key = 'posting_lockdown';
    IF v_locked AND public.flux_has_permission('posting:lockdown') THEN
      v_locked := false;
    END IF;
    v_read_only := public.flux_site_read_only();
    SELECT EXISTS (
      SELECT 1 FROM public.flux_bans b
      WHERE b.active AND b.kind = 'mute' AND b.value = v_uid::text
        AND (b.expires_at IS NULL OR b.expires_at > now())
    ) INTO v_muted;
    IF TG_OP = 'INSERT' AND NOT public.flux_has_permission('posting:slow') THEN
      SELECT max(b.cooldown_seconds) INTO v_wait FROM public.flux_bans b
        WHERE b.active AND b.kind = 'slow' AND b.value = v_uid::text
          AND (b.expires_at IS NULL OR b.expires_at > now());
      IF coalesce(v_wait, 0) > 0 THEN
        SELECT EXISTS (
          SELECT 1 FROM public.flux_public_content_log l
          WHERE l.author_id = v_uid AND l.action = 'INSERT'
            AND l.created_at > now() - make_interval(secs => v_wait)
        ) INTO v_too_soon;
      END IF;
    END IF;
  EXCEPTION WHEN others THEN
    -- A fault in this lookup must never stop a teacher posting.
    RETURN NEW;
  END;
  IF coalesce(v_read_only, false) THEN
    RAISE EXCEPTION 'Flux is read-only for a little while. Try again later.' USING ERRCODE = '42501';
  END IF;
  IF coalesce(v_locked, false) THEN
    RAISE EXCEPTION 'Posting is paused across Flux right now. Try again later.' USING ERRCODE = '42501';
  END IF;
  IF v_muted THEN
    RAISE EXCEPTION 'Posting is turned off for this account.' USING ERRCODE = '42501';
  END IF;
  IF v_too_soon THEN
    RAISE EXCEPTION 'You are posting too quickly. Wait a little and try again.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

-- The Aorta Project joins the Flux Suite directory in the same release.
-- Hidden first, so it is never public before the owner chooses.
INSERT INTO public.flux_hidden_apps (app_id) VALUES ('aorta') ON CONFLICT DO NOTHING;
