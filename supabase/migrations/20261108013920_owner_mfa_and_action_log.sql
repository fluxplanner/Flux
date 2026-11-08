-- Owner two-step sign-in, step-up for role changes, and a tamper-proof log of
-- every privileged change. Follows the 2026-11-05 incident, where a signed-in
-- account gave itself a staff role from the browser console.
--
-- 1. Owner powers need a fresh authenticator code once the owner has one set up.
--    Every owner check in the database goes through flux_is_platform_admin(),
--    so the rule lives there: a session that only used a password, or whose last
--    code is more than 12 hours old, is treated as an ordinary account.
-- 2. Changing someone's role from the browser needs a code entered in the last
--    15 minutes, even for the owner.
-- 3. flux_admin_action_log records who changed what, for whom, from where and
--    when: role changes, refused role changes, owner list changes, bans and
--    owner authenticator changes. Nobody can edit or delete its rows.

-- ---------------------------------------------------------------------------
-- Session helpers
-- ---------------------------------------------------------------------------

-- Seconds since this session last proved an authenticator code, or NULL if it
-- never did. Read from the signed token, so the browser cannot change it.
CREATE OR REPLACE FUNCTION public.flux_mfa_age_seconds()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT (extract(epoch FROM now()) - max((a ->> 'timestamp')::bigint))::integer
    FROM jsonb_array_elements(
      CASE WHEN jsonb_typeof(auth.jwt() -> 'amr') = 'array' THEN auth.jwt() -> 'amr' ELSE '[]'::jsonb END
    ) a
   WHERE a ->> 'method' = 'totp'
     AND (a ->> 'timestamp') ~ '^[0-9]+$';
$function$;

CREATE OR REPLACE FUNCTION public.flux_session_has_recent_mfa(p_max_age_seconds integer)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     AND coalesce(public.flux_mfa_age_seconds() <= p_max_age_seconds, false);
$function$;

CREATE OR REPLACE FUNCTION public.flux_user_has_mfa(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM auth.mfa_factors f
     WHERE f.user_id = p_user_id AND f.status = 'verified'
  );
$function$;

REVOKE ALL ON FUNCTION public.flux_user_has_mfa(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.flux_mfa_age_seconds() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.flux_session_has_recent_mfa(integer) TO authenticated, service_role;

-- Owner rights: on the owner list by user id, and, once an authenticator is set
-- up, a code entered within the last 12 hours. Until the owner adds one the old
-- behaviour stays, so applying this cannot lock him out; Owner Controls makes
-- him add one before it opens.
CREATE OR REPLACE FUNCTION public.flux_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
           SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = auth.uid()
         )
     AND (
           public.flux_session_has_recent_mfa(43200)
           OR NOT public.flux_user_has_mfa(auth.uid())
         );
$function$;

-- ---------------------------------------------------------------------------
-- The log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.flux_admin_action_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid,
  target_user_id uuid,
  action_type text NOT NULL,
  old_value jsonb,
  new_value jsonb,
  ip text,
  user_agent text,
  via text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.flux_admin_action_log IS
  'Append-only record of privileged changes. via: browser (signed-in request), service (an edge function acting for actor_user_id), auth (the sign-in service), database (SQL run directly).';

CREATE INDEX IF NOT EXISTS flux_admin_action_log_created_idx ON public.flux_admin_action_log (created_at DESC);
CREATE INDEX IF NOT EXISTS flux_admin_action_log_target_idx ON public.flux_admin_action_log (target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS flux_admin_action_log_actor_idx ON public.flux_admin_action_log (actor_user_id, created_at DESC);

ALTER TABLE public.flux_admin_action_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flux_admin_action_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.flux_admin_action_log TO authenticated;

DROP POLICY IF EXISTS flux_admin_action_log_owner_read ON public.flux_admin_action_log;
CREATE POLICY flux_admin_action_log_owner_read ON public.flux_admin_action_log
  FOR SELECT TO authenticated
  USING (public.flux_is_platform_admin());

-- Rows can be added, never changed or removed, whoever asks.
CREATE OR REPLACE FUNCTION public.flux_admin_action_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'flux_admin_action_log is append-only' USING ERRCODE = '42501';
END;
$function$;

DROP TRIGGER IF EXISTS flux_admin_action_log_immutable ON public.flux_admin_action_log;
CREATE TRIGGER flux_admin_action_log_immutable
  BEFORE UPDATE OR DELETE ON public.flux_admin_action_log
  FOR EACH ROW EXECUTE FUNCTION public.flux_admin_action_log_immutable();

-- Writes one row, working out who is asking and from where.
-- A browser request is the signed-in user, with the address Cloudflare saw.
-- An edge function runs as the service role; release-admin names the person it
-- acts for in x-flux-actor headers. Only the service role is believed about
-- that, and the browser can never hold the service role.
CREATE OR REPLACE FUNCTION public.flux_log_admin_action(
  p_action text,
  p_target uuid,
  p_old jsonb,
  p_new jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_headers jsonb;
  v_role text := coalesce(auth.role(), '');
  v_actor uuid;
  v_ip text;
  v_ua text;
  v_via text;
  v_actor_header text;
BEGIN
  BEGIN
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN others THEN
    v_headers := NULL;
  END;

  IF v_role = 'service_role' THEN
    v_via := 'service';
    v_actor_header := v_headers ->> 'x-flux-actor';
    IF v_actor_header ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_actor := v_actor_header::uuid;
    END IF;
    v_ip := v_headers ->> 'x-flux-ip';
    v_ua := v_headers ->> 'x-flux-ua';
  ELSIF v_role IN ('anon', 'authenticated') THEN
    v_via := 'browser';
    v_actor := auth.uid();
    v_ip := coalesce(v_headers ->> 'cf-connecting-ip',
                     nullif(btrim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), ''));
    v_ua := v_headers ->> 'user-agent';
  ELSIF session_user = 'supabase_auth_admin' THEN
    v_via := 'auth';
  ELSE
    v_via := 'database';
  END IF;

  INSERT INTO public.flux_admin_action_log
    (actor_user_id, target_user_id, action_type, old_value, new_value, ip, user_agent, via)
  VALUES
    (v_actor, p_target, p_action, p_old, p_new, left(v_ip, 100), left(v_ua, 400), v_via);
END;
$function$;

REVOKE ALL ON FUNCTION public.flux_log_admin_action(text, uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Roles: step-up, refused attempts, and every change
-- ---------------------------------------------------------------------------

-- Same rules as before (20261105214809_tighten_user_roles_policies). Two
-- additions: a refused change is logged before it is undone, and the owner
-- changing a role from the browser needs a code from the last 15 minutes.
CREATE OR REPLACE FUNCTION public.flux_guard_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_previous text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.role ELSE 'student' END;
  v_prev_school text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.school END;
  v_prev_slug text := CASE WHEN TG_OP = 'UPDATE' THEN OLD.school_slug END;
  v_approved boolean := false;
  v_approved_school text;
BEGIN
  IF NOT public.flux_request_is_from_browser() THEN
    RETURN NEW;
  END IF;
  IF public.flux_is_platform_admin() THEN
    IF NEW.role IS DISTINCT FROM v_previous
       AND NOT public.flux_session_has_recent_mfa(900) THEN
      RAISE EXCEPTION 'flux_step_up_required: enter your authenticator code again to change roles'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.role = 'student' THEN
    RETURN NEW;
  END IF;
  IF NEW.role IS NOT DISTINCT FROM v_previous THEN
    NEW.school := v_prev_school;
    NEW.school_slug := v_prev_slug;
    RETURN NEW;
  END IF;

  SELECT true, nullif(btrim(svr.school), '')
    INTO v_approved, v_approved_school
    FROM public.staff_verification_requests svr
   WHERE svr.user_id = NEW.user_id
     AND svr.verification_status = 'approved'
     AND svr.requested_role = NEW.role
   ORDER BY svr.resolved_at DESC NULLS LAST
   LIMIT 1;

  IF coalesce(v_approved, false) THEN
    IF lower(coalesce(v_approved_school, '')) IS DISTINCT FROM lower(btrim(coalesce(v_prev_school, ''))) THEN
      NEW.school_slug := NULL;
    ELSE
      NEW.school_slug := v_prev_slug;
    END IF;
    NEW.school := v_approved_school;
    RETURN NEW;
  END IF;

  PERFORM public.flux_log_admin_action(
    'role_change_refused', NEW.user_id,
    jsonb_build_object('role', v_previous),
    jsonb_build_object('role', NEW.role));

  NEW.role := v_previous;
  IF v_previous <> 'student' THEN
    NEW.school := v_prev_school;
    NEW.school_slug := v_prev_slug;
  END IF;
  RETURN NEW;
END;
$function$;

-- Runs after the guard, so it records what was actually stored. In the same
-- transaction as the change: if the log row cannot be written, neither is the
-- role.
CREATE OR REPLACE FUNCTION public.flux_log_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'student' THEN
      PERFORM public.flux_log_admin_action('role_set', NEW.user_id, NULL,
        jsonb_build_object('role', NEW.role, 'school', NEW.school));
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      PERFORM public.flux_log_admin_action('role_change', NEW.user_id,
        jsonb_build_object('role', OLD.role, 'school', OLD.school),
        jsonb_build_object('role', NEW.role, 'school', NEW.school));
    END IF;
  ELSIF OLD.role IS DISTINCT FROM 'student' THEN
    PERFORM public.flux_log_admin_action('role_removed', OLD.user_id,
      jsonb_build_object('role', OLD.role, 'school', OLD.school), NULL);
  END IF;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS flux_log_user_role_change ON public.user_roles;
CREATE TRIGGER flux_log_user_role_change
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.flux_log_user_role_change();

-- ---------------------------------------------------------------------------
-- Owner list and bans
-- ---------------------------------------------------------------------------

-- The browser has no row policy on platform_admins, so these grants did nothing;
-- removing them means a mistaken policy later cannot open the table either.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.platform_admins FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.flux_log_platform_admin_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.flux_log_admin_action(
    CASE TG_OP WHEN 'INSERT' THEN 'owner_added' WHEN 'UPDATE' THEN 'owner_changed' ELSE 'owner_removed' END,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE jsonb_build_object('user_id', OLD.user_id, 'email', OLD.email) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE jsonb_build_object('user_id', NEW.user_id, 'email', NEW.email) END);
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS flux_log_platform_admin_change ON public.platform_admins;
CREATE TRIGGER flux_log_platform_admin_change
  AFTER INSERT OR UPDATE OR DELETE ON public.platform_admins
  FOR EACH ROW EXECUTE FUNCTION public.flux_log_platform_admin_change();

CREATE OR REPLACE FUNCTION public.flux_log_ban_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_kind text;
  v_value text;
  v_target uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    v_old := jsonb_build_object('kind', OLD.kind, 'value', OLD.value, 'active', OLD.active,
                                'reason', OLD.reason, 'expires_at', OLD.expires_at);
    v_kind := OLD.kind;
    v_value := OLD.value;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    v_new := jsonb_build_object('kind', NEW.kind, 'value', NEW.value, 'active', NEW.active,
                                'reason', NEW.reason, 'expires_at', NEW.expires_at);
    v_kind := NEW.kind;
    v_value := NEW.value;
  END IF;
  IF TG_OP = 'UPDATE' AND v_old = v_new THEN
    RETURN NULL;
  END IF;
  IF v_kind = 'user' AND v_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_target := v_value::uuid;
  END IF;
  PERFORM public.flux_log_admin_action(
    CASE TG_OP WHEN 'INSERT' THEN 'ban_added' WHEN 'UPDATE' THEN 'ban_changed' ELSE 'ban_removed' END,
    v_target, v_old, v_new);
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS flux_log_ban_change ON public.flux_bans;
CREATE TRIGGER flux_log_ban_change
  AFTER INSERT OR UPDATE OR DELETE ON public.flux_bans
  FOR EACH ROW EXECUTE FUNCTION public.flux_log_ban_change();

-- ---------------------------------------------------------------------------
-- Owner authenticator changes
-- ---------------------------------------------------------------------------

-- Someone holding the owner's session adding or removing an authenticator is
-- exactly what this log is for. Only owner rows are recorded, never the secret,
-- and a failure here never blocks the sign-in service.
CREATE OR REPLACE FUNCTION public.flux_log_owner_mfa_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid;
BEGIN
  BEGIN
    v_user := CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END;
    IF NOT EXISTS (SELECT 1 FROM public.platform_admins pa WHERE pa.user_id = v_user) THEN
      RETURN NULL;
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
      RETURN NULL;
    END IF;
    PERFORM public.flux_log_admin_action(
      CASE TG_OP WHEN 'INSERT' THEN 'owner_mfa_added' WHEN 'UPDATE' THEN 'owner_mfa_status' ELSE 'owner_mfa_removed' END,
      v_user,
      CASE WHEN TG_OP = 'INSERT' THEN NULL
        ELSE jsonb_build_object('factor_id', OLD.id, 'name', OLD.friendly_name,
                                'type', OLD.factor_type::text, 'status', OLD.status::text) END,
      CASE WHEN TG_OP = 'DELETE' THEN NULL
        ELSE jsonb_build_object('factor_id', NEW.id, 'name', NEW.friendly_name,
                                'type', NEW.factor_type::text, 'status', NEW.status::text) END);
  EXCEPTION WHEN others THEN
    RAISE WARNING 'flux_log_owner_mfa_change: %', SQLERRM;
  END;
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS flux_log_owner_mfa_change ON auth.mfa_factors;
CREATE TRIGGER flux_log_owner_mfa_change
  AFTER INSERT OR UPDATE OR DELETE ON auth.mfa_factors
  FOR EACH ROW EXECUTE FUNCTION public.flux_log_owner_mfa_change();
