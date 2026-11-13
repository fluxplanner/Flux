-- More Owner Controls. Everything here is owner-only to change, and almost all
-- of it does nothing until the owner switches it on. What runs for everyone:
--
--   · flux_check_request (before every REST request) gains two checks: the
--     sign-out cut-offs, and read-only / maintenance mode. Both are off until
--     the owner uses them, and a fault in either lets the request through.
--   · New accounts pass flux_enforce_signup_policy, which is "open" until the
--     owner changes it.
--   · Shadowbanned authors' posts are hidden from everyone but themselves.
--   · Uptime: pg_cron asks the site for its front page every 5 minutes.
--
-- Undo the parts that act on everyone with:
--   DELETE FROM public.platform_settings WHERE key IN ('site_mode', 'signup_policy');
--   DELETE FROM public.flux_session_cutoffs;
--   SELECT cron.unschedule('flux-uptime');

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron;

------------------------------------------------------------------------------
-- New ban kinds: 'shadow' (posts only visible to their author) and 'slow' (a
-- wait between public posts). flux_owner_ban gains the wait, so the old
-- five-argument version is replaced rather than overloaded: two versions would
-- make every existing call ambiguous.
------------------------------------------------------------------------------

ALTER TABLE public.flux_bans ADD COLUMN IF NOT EXISTS cooldown_seconds integer;
ALTER TABLE public.flux_bans DROP CONSTRAINT IF EXISTS flux_bans_kind_check;
ALTER TABLE public.flux_bans ADD CONSTRAINT flux_bans_kind_check
  CHECK (kind IN ('user', 'ip', 'device', 'mute', 'shadow', 'slow'));

DROP FUNCTION IF EXISTS public.flux_owner_ban(text, text, text, text, timestamptz);
CREATE OR REPLACE FUNCTION public.flux_owner_ban(
  p_kind text, p_value text, p_label text DEFAULT NULL, p_reason text DEFAULT NULL,
  p_expires timestamptz DEFAULT NULL, p_cooldown integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  IF p_expires IS NOT NULL AND p_expires <= now() THEN
    RAISE EXCEPTION 'that end time has already passed' USING ERRCODE = '22023';
  END IF;
  IF p_kind = 'slow' AND coalesce(p_cooldown, 0) NOT BETWEEN 10 AND 86400 THEN
    RAISE EXCEPTION 'the wait must be between 10 seconds and a day' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.flux_bans (kind, value, label, reason, created_by, expires_at, cooldown_seconds)
  VALUES (p_kind, p_value, p_label, p_reason, auth.uid(), p_expires,
          CASE WHEN p_kind = 'slow' THEN p_cooldown END)
  ON CONFLICT (kind, value) WHERE active DO UPDATE SET
    label = coalesce(EXCLUDED.label, flux_bans.label),
    reason = coalesce(EXCLUDED.reason, flux_bans.reason),
    created_by = EXCLUDED.created_by,
    created_at = now(),
    expires_at = EXCLUDED.expires_at,
    cooldown_seconds = EXCLUDED.cooldown_seconds
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------

-- A token issued before its cut-off is refused. scope is '*' for everyone, or
-- one account's id. Deleting the sessions stops new tokens; this stops the
-- hour-long one each device already holds.
CREATE TABLE IF NOT EXISTS public.flux_session_cutoffs (
  scope text PRIMARY KEY,
  cutoff timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flux_invite_codes (
  code text PRIMARY KEY,
  note text,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A locked account keeps its display name, bio and picture whatever it sends.
CREATE TABLE IF NOT EXISTS public.flux_name_locks (
  user_id uuid PRIMARY KEY,
  reason text,
  locked_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flux_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  app text,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warning', 'urgent')),
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.flux_announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.flux_announcements (id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

-- One row per person per post. No foreign key to the post: a report must
-- survive the post being taken down.
CREATE TABLE IF NOT EXISTS public.flux_post_reports (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,
  source_id text NOT NULL,
  reporter_id uuid NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS flux_post_reports_reporter ON public.flux_post_reports (reporter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.flux_owner_alerts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind text NOT NULL,
  title text NOT NULL,
  detail text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz
);
CREATE INDEX IF NOT EXISTS flux_owner_alerts_recent ON public.flux_owner_alerts (created_at DESC);

CREATE TABLE IF NOT EXISTS public.flux_uptime_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  target text NOT NULL,
  request_id bigint,
  checked_at timestamptz NOT NULL DEFAULT now(),
  status integer,
  ms integer,
  ok boolean,
  error text
);
CREATE INDEX IF NOT EXISTS flux_uptime_checks_recent ON public.flux_uptime_checks (target, checked_at DESC);

CREATE INDEX IF NOT EXISTS flux_public_content_log_author ON public.flux_public_content_log (author_id, created_at DESC);

-- Owner-only, every one of them.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['flux_session_cutoffs', 'flux_invite_codes', 'flux_name_locks',
                           'flux_announcement_reads', 'flux_post_reports', 'flux_owner_alerts',
                           'flux_uptime_checks'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated '
                   'USING (public.flux_is_platform_admin()) WITH CHECK (public.flux_is_platform_admin())',
                   t || '_owner', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  END LOOP;
END $$;

-- Announcements are read by every page, signed in or not, while they are live.
ALTER TABLE public.flux_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS flux_announcements_read_live ON public.flux_announcements;
CREATE POLICY flux_announcements_read_live ON public.flux_announcements FOR SELECT TO anon, authenticated
  USING (active AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));
DROP POLICY IF EXISTS flux_announcements_owner ON public.flux_announcements;
CREATE POLICY flux_announcements_owner ON public.flux_announcements FOR ALL TO authenticated
  USING (public.flux_is_platform_admin()) WITH CHECK (public.flux_is_platform_admin());
GRANT SELECT ON public.flux_announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flux_announcements TO authenticated;

------------------------------------------------------------------------------
-- Site mode: normal, read-only, or maintenance (read-only plus a screen).
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.flux_site_read_only()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT coalesce((
    SELECT s.value->>'mode' = 'read_only'
        OR (s.value->>'mode' = 'maintenance'
            AND coalesce((s.value->>'starts_at')::timestamptz, '-infinity') <= now()
            AND coalesce((s.value->>'ends_at')::timestamptz, 'infinity') > now())
    FROM public.platform_settings s WHERE s.key = 'site_mode'
  ), false);
$function$;

-- Same as the live function, plus the sign-out cut-offs and read-only mode.
-- Read-only stops table writes. Functions (/rpc/) still run, because reads go
-- through them too, and every one that posts publicly is covered by the
-- posting rules below.
CREATE OR REPLACE FUNCTION public.flux_check_request()
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid;
  v_banned boolean := false;
  v_signed_out boolean := false;
  v_read_only boolean := false;
  v_iat timestamptz;
BEGIN
  BEGIN
    IF coalesce(auth.role(), '') = 'service_role' OR public.flux_is_platform_admin() THEN
      RETURN;
    END IF;
    v_uid := auth.uid();
    SELECT EXISTS (
      SELECT 1 FROM public.flux_bans b
      WHERE b.active AND (b.expires_at IS NULL OR b.expires_at > now()) AND (
        (b.kind = 'ip' AND b.value = public.flux_request_ip())
        OR (b.kind = 'user' AND b.value = v_uid::text)
      )
    ) INTO v_banned;
    -- Signed-out visitors carry the anon key, whose iat is older than any
    -- cut-off: checking them would lock everyone out of the sign-in page.
    IF v_uid IS NOT NULL THEN
      v_iat := to_timestamp((nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'iat')::double precision);
      SELECT EXISTS (
        SELECT 1 FROM public.flux_session_cutoffs c
        WHERE c.scope IN ('*', v_uid::text) AND c.cutoff > v_iat
      ) INTO v_signed_out;
    END IF;
    IF upper(coalesce(current_setting('request.method', true), 'GET')) IN ('POST', 'PATCH', 'PUT', 'DELETE')
       AND coalesce(current_setting('request.path', true), '') NOT LIKE '/rpc/%' THEN
      v_read_only := public.flux_site_read_only();
    END IF;
  EXCEPTION WHEN others THEN
    -- A fault in any of these lookups must never take the whole planner down.
    RETURN;
  END;
  IF v_banned THEN
    RAISE SQLSTATE 'PT403' USING MESSAGE = 'flux_banned';
  END IF;
  IF coalesce(v_signed_out, false) THEN
    RAISE SQLSTATE 'PT401' USING MESSAGE = 'flux_signed_out';
  END IF;
  IF coalesce(v_read_only, false) THEN
    RAISE SQLSTATE 'PT503' USING MESSAGE = 'flux_read_only';
  END IF;
END;
$function$;

------------------------------------------------------------------------------
-- Posting rules: the old ones, plus read-only mode (for posting functions)
-- and a wait between posts for slowed-down accounts.
------------------------------------------------------------------------------

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
    v_read_only := public.flux_site_read_only();
    SELECT EXISTS (
      SELECT 1 FROM public.flux_bans b
      WHERE b.active AND b.kind = 'mute' AND b.value = v_uid::text
        AND (b.expires_at IS NULL OR b.expires_at > now())
    ) INTO v_muted;
    IF TG_OP = 'INSERT' THEN
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

------------------------------------------------------------------------------
-- Shadowban: a restrictive policy, so it narrows every existing read policy
-- without touching any of them. The author still sees their own posts.
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.flux_is_shadowed(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p_user IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.flux_bans b
    WHERE b.active AND b.kind = 'shadow' AND b.value = p_user::text
      AND (b.expires_at IS NULL OR b.expires_at > now())
  );
$function$;

DO $$
DECLARE
  pair text[];
BEGIN
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
    ARRAY['school_feed', 'posted_by'],
    ARRAY['school_announcements', 'posted_by'],
    ARRAY['teacher_announcements', 'teacher_id']
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS flux_shadow_hide ON public.%I', pair[1]);
    EXECUTE format('CREATE POLICY flux_shadow_hide ON public.%I AS RESTRICTIVE FOR SELECT TO public '
                   'USING (NOT public.flux_is_shadowed(%I) OR %I = auth.uid() OR public.flux_is_platform_admin())',
                   pair[1], pair[2], pair[2]);
  END LOOP;
END $$;

------------------------------------------------------------------------------
-- Sign-ups: open, invite code, or closed. Accounts the owner makes are marked
-- in app_metadata, which a person signing themselves up cannot set.
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.flux_enforce_signup_policy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_mode text := 'open';
  v_code text;
  v_hit text;
BEGIN
  BEGIN
    SELECT coalesce(s.value->>'mode', 'open') INTO v_mode
      FROM public.platform_settings s WHERE s.key = 'signup_policy';
  EXCEPTION WHEN others THEN
    v_mode := 'open';
  END;
  IF coalesce(v_mode, 'open') = 'open'
     OR coalesce(NEW.raw_app_meta_data->>'flux_owner_created', '') = 'true' THEN
    RETURN NEW;
  END IF;
  IF v_mode = 'closed' THEN
    RAISE EXCEPTION 'flux_signup_closed' USING ERRCODE = 'P0001';
  END IF;
  v_code := upper(trim(coalesce(NEW.raw_user_meta_data->>'invite_code', '')));
  UPDATE public.flux_invite_codes c SET uses = c.uses + 1
    WHERE c.code = v_code AND c.active
      AND (c.expires_at IS NULL OR c.expires_at > now())
      AND (c.max_uses IS NULL OR c.uses < c.max_uses)
    RETURNING c.code INTO v_hit;
  IF v_hit IS NULL THEN
    RAISE EXCEPTION 'flux_invite_required' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.flux_enforce_signup_policy() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS flux_enforce_signup_policy ON auth.users;
CREATE TRIGGER flux_enforce_signup_policy BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.flux_enforce_signup_policy();

------------------------------------------------------------------------------
-- Name locks
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.flux_enforce_name_lock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.flux_is_platform_admin() OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.flux_name_locks l WHERE l.user_id = NEW.user_id) THEN
    NEW.display_name := OLD.display_name;
    NEW.bio := OLD.bio;
    NEW.avatar_url := OLD.avatar_url;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE ALL ON FUNCTION public.flux_enforce_name_lock() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS flux_enforce_name_lock ON public.user_roles;
CREATE TRIGGER flux_enforce_name_lock BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.flux_enforce_name_lock();

------------------------------------------------------------------------------
-- Alerts for the owner
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.flux_owner_alert(p_kind text, p_title text, p_detail text DEFAULT NULL, p_user uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- The same alert, still unread, is not repeated within the hour.
  IF EXISTS (SELECT 1 FROM public.flux_owner_alerts a
             WHERE a.kind = p_kind AND a.title = p_title AND a.seen_at IS NULL
               AND a.created_at > now() - interval '1 hour') THEN
    RETURN;
  END IF;
  INSERT INTO public.flux_owner_alerts (kind, title, detail, user_id)
  VALUES (p_kind, left(p_title, 200), left(p_detail, 2000), p_user);
END;
$function$;
REVOKE ALL ON FUNCTION public.flux_owner_alert(text, text, text, uuid) FROM PUBLIC, anon, authenticated;

-- Same as the live function, plus two alerts: the owner's account on a device
-- it has never used, and a banned device signing in to another account.
CREATE OR REPLACE FUNCTION public.flux_device_checkin(p_device text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ip text := coalesce(public.flux_request_ip(), '');
  v_device text := lower(trim(coalesce(p_device, '')));
  h jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  v_known boolean;
  v_any boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('banned', false);
  END IF;
  -- A strange id is still recorded, marked, so the address is never lost.
  IF v_device !~ '^[a-f0-9-]{16,64}$' THEN
    v_device := 'invalid';
  END IF;
  IF public.flux_is_platform_admin() THEN
    BEGIN
      SELECT EXISTS (SELECT 1 FROM public.flux_user_sightings s WHERE s.user_id = v_uid),
             EXISTS (SELECT 1 FROM public.flux_user_sightings s WHERE s.user_id = v_uid AND s.device_id = v_device)
        INTO v_any, v_known;
      INSERT INTO public.flux_user_sightings (user_id, device_id, ip, user_agent)
      VALUES (v_uid, v_device, v_ip, left(h->>'user-agent', 300))
      ON CONFLICT (user_id, device_id, ip) DO UPDATE SET last_seen = now(), user_agent = EXCLUDED.user_agent;
      IF v_any AND NOT v_known THEN
        PERFORM public.flux_owner_alert('owner_new_device', 'Your owner account was used on a new device',
          'Address ' || v_ip || ' · ' || left(coalesce(h->>'user-agent', 'unknown browser'), 200), v_uid);
      END IF;
    EXCEPTION WHEN others THEN
      NULL; -- the owner must never be locked out by bookkeeping
    END;
    RETURN jsonb_build_object('banned', false);
  END IF;
  INSERT INTO public.flux_user_sightings (user_id, device_id, ip, user_agent)
  VALUES (v_uid, v_device, v_ip, left(h->>'user-agent', 300))
  ON CONFLICT (user_id, device_id, ip) DO UPDATE SET last_seen = now(), user_agent = EXCLUDED.user_agent;
  DELETE FROM public.flux_user_sightings s
  WHERE s.user_id = v_uid AND (s.device_id, s.ip) IN (
    SELECT device_id, ip FROM public.flux_user_sightings WHERE user_id = v_uid ORDER BY last_seen DESC OFFSET 25
  );
  UPDATE public.flux_bans SET active = false, lifted_at = now()
    WHERE active AND expires_at IS NOT NULL AND expires_at <= now();
  IF EXISTS (SELECT 1 FROM public.flux_bans b WHERE b.active AND b.kind = 'device' AND b.value = v_device) THEN
    INSERT INTO public.flux_bans (kind, value, reason)
    VALUES ('user', v_uid::text, 'Signed in on banned device ' || v_device)
    ON CONFLICT (kind, value) WHERE active DO NOTHING;
    PERFORM public.flux_owner_alert('ban_evasion', 'A banned device signed in to another account',
      'Device ' || v_device || ' · address ' || v_ip || '. That account is now banned too.', v_uid);
    RETURN jsonb_build_object('banned', true);
  END IF;
  RETURN jsonb_build_object('banned', false);
END;
$function$;

------------------------------------------------------------------------------
-- Reporting a post (anyone signed in) and the threshold that alerts the owner
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.flux_report_post(p_source text, p_id text, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
  v_threshold integer;
  v_auto_hide boolean;
  v_new boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'sign in to report a post' USING ERRCODE = '42501';
  END IF;
  IF p_source NOT IN ('school_feed', 'school_announcements', 'teacher_announcements') THEN
    RAISE EXCEPTION 'that cannot be reported' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM public.flux_post_reports r
      WHERE r.reporter_id = v_uid AND r.created_at > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'You have sent a lot of reports today. Try again tomorrow.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.flux_post_reports (source, source_id, reporter_id, reason)
  VALUES (p_source, left(p_id, 80), v_uid, left(p_reason, 500))
  ON CONFLICT (source, source_id, reporter_id) DO NOTHING
  RETURNING true INTO v_new;
  SELECT count(*) INTO v_count FROM public.flux_post_reports r WHERE r.source = p_source AND r.source_id = left(p_id, 80);
  SELECT coalesce((s.value->>'report_threshold')::int, 3), coalesce((s.value->>'auto_hide')::boolean, false)
    INTO v_threshold, v_auto_hide
    FROM public.platform_settings s WHERE s.key = 'moderation_policy';
  v_threshold := greatest(coalesce(v_threshold, 3), 1);
  IF coalesce(v_new, false) AND v_count = v_threshold THEN
    PERFORM public.flux_owner_alert('reports', 'A post reached ' || v_count || ' reports',
      p_source || ' ' || p_id || CASE WHEN coalesce(v_auto_hide, false) THEN ' · taken down automatically' ELSE '' END, NULL);
    IF coalesce(v_auto_hide, false) THEN
      -- The archive trigger keeps a copy, as with any take-down.
      EXECUTE format('DELETE FROM public.%I WHERE id::text = $1', p_source) USING p_id;
      INSERT INTO public.flux_mod_actions (kind, detail)
      VALUES ('takedown', p_source || ' ' || p_id || ': reached ' || v_count || ' reports');
    END IF;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$function$;

------------------------------------------------------------------------------
-- Announcements read by everyone, and client error reports
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.flux_mark_announcement_read(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.flux_announcement_reads (announcement_id, user_id)
  SELECT a.id, auth.uid() FROM public.flux_announcements a WHERE a.id = p_id
  ON CONFLICT DO NOTHING;
END;
$function$;

-- Anyone may report an error, signed out included, but only 30 an hour from
-- one account or address, and only so much text.
CREATE OR REPLACE FUNCTION public.flux_report_client_error(
  p_message text, p_source text DEFAULT NULL, p_line integer DEFAULT NULL, p_page text DEFAULT NULL, p_version text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_who text := coalesce(auth.uid()::text, 'ip:' || coalesce(public.flux_request_ip(), '?'));
  h jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
BEGIN
  IF (SELECT count(*) FROM public.error_logs e
      WHERE e.user_id = v_who AND e.created_at > now() - interval '1 hour') >= 30 THEN
    RETURN;
  END IF;
  INSERT INTO public.error_logs (user_id, message, url, user_agent, app_version, context)
  VALUES (v_who, left(coalesce(p_message, 'unknown'), 300), left(p_page, 200), left(h->>'user-agent', 300),
          left(p_version, 40), jsonb_build_object('via', 'flux_report_client_error', 'source', left(p_source, 100), 'line', p_line));
END;
$function$;

------------------------------------------------------------------------------
-- Uptime: every 5 minutes, ask for the front page and Flux Suite, and read the
-- answers to the previous round.
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.flux_uptime_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  t text;
BEGIN
  UPDATE public.flux_uptime_checks c SET
    status = r.status_code,
    ok = NOT coalesce(r.timed_out, false) AND r.error_msg IS NULL AND r.status_code BETWEEN 200 AND 399,
    ms = greatest(0, (extract(epoch FROM r.created - c.checked_at) * 1000)::int),
    error = coalesce(r.error_msg, CASE WHEN r.timed_out THEN 'timed out' END)
  FROM net._http_response r
  WHERE r.id = c.request_id AND c.ok IS NULL;
  UPDATE public.flux_uptime_checks c SET ok = false, error = 'no answer'
    WHERE c.ok IS NULL AND c.checked_at < now() - interval '4 minutes';

  FOREACH t IN ARRAY ARRAY['https://fluxplanner.github.io/Flux/', 'https://fluxplanner.github.io/Flux/suite.html'] LOOP
    IF (SELECT count(*) FILTER (WHERE NOT x.ok) FROM (
          SELECT c.ok FROM public.flux_uptime_checks c
          WHERE c.target = t AND c.ok IS NOT NULL ORDER BY c.checked_at DESC LIMIT 2) x) = 2 THEN
      PERFORM public.flux_owner_alert('uptime', 'Flux is not answering', t || ' failed twice in a row.', NULL);
    END IF;
    INSERT INTO public.flux_uptime_checks (target, request_id)
    VALUES (t, net.http_get(url := t, timeout_milliseconds := 15000));
  END LOOP;

  DELETE FROM public.flux_uptime_checks WHERE checked_at < now() - interval '30 days';
  DELETE FROM public.error_logs WHERE created_at < now() - interval '30 days'
    AND context->>'via' = 'flux_report_client_error';
END;
$function$;
REVOKE ALL ON FUNCTION public.flux_uptime_tick() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'flux-uptime';
  PERFORM cron.schedule('flux-uptime', '*/5 * * * *', 'SELECT public.flux_uptime_tick()');
END $$;

------------------------------------------------------------------------------
-- Owner functions
------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.flux_owner_set_setting(p_key text, p_value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  -- Each key's value is rebuilt from known fields, never stored as sent: this
  -- table is readable by anyone, signed in or not.
  IF p_key = 'site_mode' THEN
    IF coalesce(p_value->>'mode', '') NOT IN ('normal', 'read_only', 'maintenance') THEN
      RAISE EXCEPTION 'unknown site mode' USING ERRCODE = '22023';
    END IF;
    v := jsonb_build_object('mode', p_value->>'mode', 'message', left(p_value->>'message', 500),
      'starts_at', (p_value->>'starts_at')::timestamptz, 'ends_at', (p_value->>'ends_at')::timestamptz, 'changed_at', now());
  ELSIF p_key = 'signup_policy' THEN
    IF coalesce(p_value->>'mode', '') NOT IN ('open', 'invite', 'closed') THEN
      RAISE EXCEPTION 'unknown sign-up mode' USING ERRCODE = '22023';
    END IF;
    v := jsonb_build_object('mode', p_value->>'mode', 'changed_at', now());
  ELSIF p_key = 'moderation_policy' THEN
    v := jsonb_build_object(
      'report_threshold', least(greatest(coalesce((p_value->>'report_threshold')::int, 3), 1), 50),
      'auto_hide', coalesce((p_value->>'auto_hide')::boolean, false), 'changed_at', now());
  ELSE
    RAISE EXCEPTION 'that setting cannot be changed here' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.platform_settings (key, value, updated_at, updated_by)
  VALUES (p_key, v, now(), 'owner controls')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by;
  INSERT INTO public.flux_mod_actions (kind, detail, created_by) VALUES ('setting', p_key || ' = ' || v::text, auth.uid());
  RETURN v;
END;
$function$;

CREATE OR REPLACE FUNCTION public.flux_owner_create_invite(p_note text DEFAULT NULL, p_max_uses integer DEFAULT NULL, p_days integer DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  -- No 0/O or 1/I/L: these get read aloud and copied off a board.
  v_alpha text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_bytes bytea := gen_random_bytes(8);
  i integer;
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  FOR i IN 0..7 LOOP
    v_code := v_code || substr(v_alpha, (get_byte(v_bytes, i) % length(v_alpha)) + 1, 1);
  END LOOP;
  INSERT INTO public.flux_invite_codes (code, note, max_uses, expires_at, created_by)
  VALUES (v_code, left(p_note, 200), CASE WHEN p_max_uses > 0 THEN p_max_uses END,
          CASE WHEN p_days > 0 THEN now() + make_interval(days => p_days) END, auth.uid());
  RETURN v_code;
END;
$function$;

CREATE OR REPLACE FUNCTION public.flux_owner_sessions(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id', s.id, 'created_at', s.created_at, 'refreshed_at', coalesce(s.refreshed_at, s.updated_at),
      'user_agent', s.user_agent, 'ip', host(s.ip)) ORDER BY coalesce(s.refreshed_at, s.updated_at) DESC NULLS LAST)
    FROM auth.sessions s WHERE s.user_id = p_user), '[]'::jsonb);
END;
$function$;

-- p_user NULL signs out everyone but the caller. p_session ends one sign-in.
CREATE OR REPLACE FUNCTION public.flux_owner_sign_out(p_user uuid DEFAULT NULL, p_session uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_scope text;
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  IF p_session IS NOT NULL THEN
    DELETE FROM auth.sessions s WHERE s.id = p_session AND s.user_id = p_user AND s.user_id <> auth.uid();
    GET DIAGNOSTICS v_count = ROW_COUNT;
    INSERT INTO public.flux_mod_actions (user_id, kind, detail, created_by)
    VALUES (p_user, 'signed out', 'Ended one sign-in', auth.uid());
    -- One device cannot be told apart from the others by its token, so its
    -- token lasts until it expires (an hour at most). It cannot be renewed.
    RETURN v_count;
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'that is your own account' USING ERRCODE = '22023';
  END IF;
  v_scope := coalesce(p_user::text, '*');
  DELETE FROM auth.sessions s WHERE (p_user IS NULL OR s.user_id = p_user) AND s.user_id <> auth.uid();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  INSERT INTO public.flux_session_cutoffs (scope, cutoff) VALUES (v_scope, now())
  ON CONFLICT (scope) DO UPDATE SET cutoff = now();
  INSERT INTO public.flux_mod_actions (user_id, kind, detail, created_by)
  VALUES (p_user, 'signed out', CASE WHEN p_user IS NULL THEN 'Signed out everyone (' || v_count || ' sign-ins)' ELSE 'Signed out everywhere' END, auth.uid());
  RETURN v_count;
END;
$function$;

CREATE OR REPLACE FUNCTION public.flux_owner_profiles(p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM (
    SELECT ur.user_id, split_part(u.email, '@', 1) AS username, ur.display_name, ur.bio, ur.avatar_url, ur.role,
           ur.updated_at, (l.user_id IS NOT NULL) AS locked, l.reason AS lock_reason
    FROM public.user_roles ur
    LEFT JOIN auth.users u ON u.id = ur.user_id
    LEFT JOIN public.flux_name_locks l ON l.user_id = ur.user_id
    WHERE nullif(trim(coalesce(ur.display_name, '')), '') IS NOT NULL
       OR nullif(trim(coalesce(ur.bio, '')), '') IS NOT NULL
       OR nullif(trim(coalesce(ur.avatar_url, '')), '') IS NOT NULL
    ORDER BY ur.updated_at DESC NULLS LAST
    LIMIT least(greatest(coalesce(p_limit, 200), 1), 1000)) p), '[]'::jsonb);
END;
$function$;

-- p_display_name NULL leaves the name alone. p_clear lists fields to empty:
-- 'bio', 'avatar_url'. p_lock NULL leaves the lock alone.
CREATE OR REPLACE FUNCTION public.flux_owner_set_profile(
  p_user uuid, p_display_name text DEFAULT NULL, p_clear text[] DEFAULT '{}', p_lock boolean DEFAULT NULL, p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  UPDATE public.user_roles ur SET
    display_name = CASE WHEN p_display_name IS NOT NULL THEN nullif(left(trim(p_display_name), 80), '') ELSE ur.display_name END,
    bio = CASE WHEN 'bio' = ANY (p_clear) THEN NULL ELSE ur.bio END,
    avatar_url = CASE WHEN 'avatar_url' = ANY (p_clear) THEN NULL ELSE ur.avatar_url END,
    updated_at = now()
  WHERE ur.user_id = p_user;
  IF p_lock IS TRUE THEN
    INSERT INTO public.flux_name_locks (user_id, reason) VALUES (p_user, left(p_reason, 300))
    ON CONFLICT (user_id) DO UPDATE SET reason = EXCLUDED.reason, locked_at = now();
  ELSIF p_lock IS FALSE THEN
    DELETE FROM public.flux_name_locks WHERE user_id = p_user;
  END IF;
  INSERT INTO public.flux_mod_actions (user_id, kind, detail, created_by)
  VALUES (p_user, 'profile', concat_ws('; ',
    CASE WHEN p_display_name IS NOT NULL THEN 'name set to ' || p_display_name END,
    CASE WHEN cardinality(p_clear) > 0 THEN 'cleared ' || array_to_string(p_clear, ', ') END,
    CASE WHEN p_lock IS TRUE THEN 'name locked' WHEN p_lock IS FALSE THEN 'name unlocked' END,
    p_reason), auth.uid());
END;
$function$;

-- Changes the name someone signs in with. Their password stays the same.
-- Only for name + password accounts: the address is synthesised from the name.
CREATE OR REPLACE FUNCTION public.flux_owner_rename_username(p_user uuid, p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text := lower(trim(coalesce(p_username, '')));
  v_email text;
  v_old text;
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  IF p_user = auth.uid() THEN
    RAISE EXCEPTION 'rename your own account from the planner' USING ERRCODE = '22023';
  END IF;
  -- The shape fluxNormalizeUsername produces in the planner.
  IF v_name !~ '^[a-z0-9]([a-z0-9._-]{0,62}[a-z0-9])?$' OR v_name ~ '\.\.' THEN
    RAISE EXCEPTION 'a username is lower-case letters, numbers, dots, dashes and underscores' USING ERRCODE = '22023';
  END IF;
  v_email := v_name || '@users.fluxplanner.app';
  SELECT u.email INTO v_old FROM auth.users u WHERE u.id = p_user;
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'no such account' USING ERRCODE = '22023';
  END IF;
  IF v_old NOT LIKE '%@users.fluxplanner.app' THEN
    RAISE EXCEPTION 'this account does not sign in with a name and password' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM auth.users u WHERE lower(u.email) = v_email AND u.id <> p_user) THEN
    RAISE EXCEPTION 'that username is taken' USING ERRCODE = '23505';
  END IF;
  UPDATE auth.users SET email = v_email, updated_at = now() WHERE id = p_user;
  UPDATE auth.identities SET identity_data = identity_data || jsonb_build_object('email', v_email), updated_at = now()
    WHERE user_id = p_user AND provider = 'email';
  -- Their tokens still carry the old address.
  DELETE FROM auth.sessions WHERE user_id = p_user;
  INSERT INTO public.flux_session_cutoffs (scope, cutoff) VALUES (p_user::text, now())
  ON CONFLICT (scope) DO UPDATE SET cutoff = now();
  INSERT INTO public.flux_mod_actions (user_id, kind, detail, created_by)
  VALUES (p_user, 'renamed', split_part(v_old, '@', 1) || ' → ' || v_name, auth.uid());
  RETURN v_name;
END;
$function$;

-- Everything Flux holds about one person, for a data request: every public
-- table with a user_id column, their synced planner, and their account.
CREATE OR REPLACE FUNCTION public.flux_owner_export_person(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_out jsonb;
  v_rows jsonb;
  r record;
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  v_out := jsonb_build_object(
    'exported_at', now(),
    'account', (SELECT jsonb_build_object('id', u.id, 'username', split_part(u.email, '@', 1), 'created_at', u.created_at,
                  'last_sign_in_at', u.last_sign_in_at, 'user_metadata', u.raw_user_meta_data)
                FROM auth.users u WHERE u.id = p_user),
    'user_data', (SELECT to_jsonb(d) FROM public.user_data d WHERE d.id = p_user)
  );
  FOR r IN
    SELECT c.table_name FROM information_schema.columns c
    JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public' AND c.column_name = 'user_id' AND c.data_type IN ('uuid', 'text')
    ORDER BY c.table_name
  LOOP
    EXECUTE format('SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM public.%I WHERE user_id::text = $1 LIMIT 2000) x', r.table_name)
      INTO v_rows USING p_user::text;
    IF v_rows IS NOT NULL THEN
      v_out := v_out || jsonb_build_object(r.table_name, v_rows);
    END IF;
  END LOOP;
  RETURN v_out;
END;
$function$;

CREATE OR REPLACE FUNCTION public.flux_owner_announcements()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'active_7d', (SELECT count(DISTINCT s.user_id) FROM public.flux_user_sightings s WHERE s.last_seen > now() - interval '7 days'),
    'items', coalesce((SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC) FROM (
      SELECT x.*, (SELECT count(*) FROM public.flux_announcement_reads r WHERE r.announcement_id = x.id) AS reads
      FROM public.flux_announcements x ORDER BY x.created_at DESC LIMIT 100) a), '[]'::jsonb));
END;
$function$;

CREATE OR REPLACE FUNCTION public.flux_owner_errors(p_days integer DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.times DESC) FROM (
    SELECT e.message, e.context->>'source' AS source, count(*) AS times, count(DISTINCT e.user_id) AS people,
           max(e.created_at) AS last_seen, min(e.created_at) AS first_seen,
           (array_agg(e.url ORDER BY e.created_at DESC))[1] AS page,
           (array_agg(e.app_version ORDER BY e.created_at DESC))[1] AS version
    FROM public.error_logs e
    WHERE e.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 7), 1), 30))
    GROUP BY e.message, e.context->>'source'
    ORDER BY count(*) DESC LIMIT 200) g), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.flux_owner_uptime(p_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'scheduled', EXISTS (SELECT 1 FROM cron.job j WHERE j.jobname = 'flux-uptime' AND j.active),
    'targets', coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM (
      SELECT c.target,
             count(*) FILTER (WHERE c.ok) AS up, count(*) FILTER (WHERE c.ok IS FALSE) AS down,
             round(avg(c.ms) FILTER (WHERE c.ok)) AS avg_ms,
             (SELECT jsonb_agg(jsonb_build_object('at', z.checked_at, 'ok', z.ok, 'status', z.status, 'ms', z.ms, 'error', z.error) ORDER BY z.checked_at DESC)
              FROM (SELECT * FROM public.flux_uptime_checks y WHERE y.target = c.target AND y.ok IS NOT NULL ORDER BY y.checked_at DESC LIMIT 288) z) AS recent
      FROM public.flux_uptime_checks c
      WHERE c.checked_at > now() - make_interval(hours => least(greatest(coalesce(p_hours, 24), 1), 720))
      GROUP BY c.target) t), '[]'::jsonb));
END;
$function$;

CREATE OR REPLACE FUNCTION public.flux_owner_db_health()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_slow jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  BEGIN
    SELECT coalesce(jsonb_agg(to_jsonb(q)), '[]'::jsonb) INTO v_slow FROM (
      SELECT left(regexp_replace(s.query, '\s+', ' ', 'g'), 240) AS query, s.calls,
             round(s.mean_exec_time::numeric, 1) AS mean_ms, round(s.total_exec_time::numeric) AS total_ms
      FROM pg_stat_statements s
      WHERE s.dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
      ORDER BY s.total_exec_time DESC LIMIT 12) q;
  EXCEPTION WHEN others THEN
    v_slow := '[]'::jsonb;
  END;
  RETURN jsonb_build_object(
    'size_bytes', pg_database_size(current_database()),
    'limit_bytes', 500 * 1024 * 1024,
    'tables', (SELECT jsonb_agg(to_jsonb(t)) FROM (
      SELECT c.relname AS name, pg_total_relation_size(c.oid) AS bytes, c.reltuples::bigint AS rows
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname IN ('public', 'auth') AND c.relkind = 'r'
      ORDER BY pg_total_relation_size(c.oid) DESC LIMIT 12) t),
    'connections', (SELECT jsonb_object_agg(coalesce(a.state, 'background'), a.n) FROM (
      SELECT state, count(*) AS n FROM pg_stat_activity WHERE datname = current_database() GROUP BY state) a),
    'running', (SELECT coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) FROM (
      SELECT a.pid, a.usename AS role, a.state, round(extract(epoch FROM now() - a.query_start)) AS seconds,
             left(regexp_replace(a.query, '\s+', ' ', 'g'), 240) AS query
      FROM pg_stat_activity a
      WHERE a.datname = current_database() AND a.backend_type = 'client backend' AND a.pid <> pg_backend_pid()
        AND a.state <> 'idle' AND a.query_start < now() - interval '5 seconds'
      ORDER BY a.query_start LIMIT 20) r),
    'slow', v_slow
  );
END;
$function$;

-- Cancels one running query: the gentlest stop there is. The connection stays.
CREATE OR REPLACE FUNCTION public.flux_owner_cancel_query(p_pid integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_query text;
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  SELECT left(a.query, 300) INTO v_query FROM pg_stat_activity a
    WHERE a.pid = p_pid AND a.datname = current_database() AND a.backend_type = 'client backend'
      AND a.pid <> pg_backend_pid() AND a.state <> 'idle';
  IF v_query IS NULL THEN
    RETURN false;
  END IF;
  INSERT INTO public.flux_mod_actions (kind, detail, created_by) VALUES ('stopped query', v_query, auth.uid());
  RETURN pg_cancel_backend(p_pid);
END;
$function$;

-- Same as the live function, plus the new counts for Today.
CREATE OR REPLACE FUNCTION public.flux_owner_mod_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'bans', (SELECT count(*) FROM public.flux_bans b WHERE b.active AND b.kind IN ('user', 'ip', 'device') AND (b.expires_at IS NULL OR b.expires_at > now())),
    'mutes', (SELECT count(*) FROM public.flux_bans b WHERE b.active AND b.kind IN ('mute', 'shadow', 'slow') AND (b.expires_at IS NULL OR b.expires_at > now())),
    'posts_24h', (SELECT count(*) FROM public.flux_public_content_log l WHERE l.created_at > now() - interval '24 hours' AND l.source <> 'platform_settings'),
    'active_24h', (SELECT count(DISTINCT s.user_id) FROM public.flux_user_sightings s WHERE s.last_seen > now() - interval '24 hours'),
    'shared_ips', (SELECT count(*) FROM (SELECT s.ip FROM public.flux_user_sightings s WHERE s.ip <> '' GROUP BY s.ip HAVING count(DISTINCT s.user_id) > 1) x),
    'new_accounts_7d', (SELECT count(*) FROM auth.users u WHERE u.created_at > now() - interval '7 days'),
    'accounts', (SELECT count(*) FROM auth.users),
    'password_help', (SELECT count(*) FROM public.flux_password_help p WHERE NOT coalesce(p.handled, false)),
    'staff_waiting', (SELECT count(*) FROM public.staff_verification_requests r WHERE r.verification_status = 'pending'),
    'rooms_open', (SELECT count(*) FROM public.flux_study_rooms r WHERE r.active),
    'lockdown', coalesce((SELECT (s.value->>'on')::boolean FROM public.platform_settings s WHERE s.key = 'posting_lockdown'), false),
    'alerts', (SELECT count(*) FROM public.flux_owner_alerts a WHERE a.seen_at IS NULL),
    'reported_posts', (SELECT count(DISTINCT (r.source, r.source_id)) FROM public.flux_post_reports r WHERE r.created_at > now() - interval '7 days'),
    'errors_24h', (SELECT count(*) FROM public.error_logs e WHERE e.created_at > now() - interval '24 hours'),
    'signed_in', (SELECT count(*) FROM auth.sessions s WHERE coalesce(s.refreshed_at, s.updated_at, s.created_at) > now() - interval '1 day'),
    'site_mode', coalesce((SELECT s.value->>'mode' FROM public.platform_settings s WHERE s.key = 'site_mode'), 'normal'),
    'signup_mode', coalesce((SELECT s.value->>'mode' FROM public.platform_settings s WHERE s.key = 'signup_policy'), 'open')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.flux_owner_reported_posts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(g) ORDER BY g.last_at DESC) FROM (
    SELECT r.source, r.source_id, count(*) AS reports, max(r.created_at) AS last_at,
           array_agg(DISTINCT r.reason) FILTER (WHERE r.reason IS NOT NULL) AS reasons,
           (SELECT to_jsonb(l) FROM public.flux_public_content_log l
             WHERE l.source = r.source AND l.source_id = r.source_id ORDER BY l.created_at DESC LIMIT 1) AS post
    FROM public.flux_post_reports r
    GROUP BY r.source, r.source_id
    ORDER BY max(r.created_at) DESC LIMIT 200) g), '[]'::jsonb);
END;
$function$;

------------------------------------------------------------------------------
-- Who may call what
------------------------------------------------------------------------------

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'flux_owner_ban(text, text, text, text, timestamptz, integer)',
    'flux_owner_set_setting(text, jsonb)',
    'flux_owner_create_invite(text, integer, integer)',
    'flux_owner_sessions(uuid)',
    'flux_owner_sign_out(uuid, uuid)',
    'flux_owner_profiles(integer)',
    'flux_owner_set_profile(uuid, text, text[], boolean, text)',
    'flux_owner_rename_username(uuid, text)',
    'flux_owner_export_person(uuid)',
    'flux_owner_announcements()',
    'flux_owner_errors(integer)',
    'flux_owner_uptime(integer)',
    'flux_owner_db_health()',
    'flux_owner_cancel_query(integer)',
    'flux_owner_mod_summary()',
    'flux_owner_reported_posts()',
    'flux_report_post(text, text, text)',
    'flux_mark_announcement_read(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION public.flux_report_client_error(text, text, integer, text, text) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.flux_report_client_error(text, text, integer, text, text) TO anon, authenticated;
  -- Used inside policies and the request check, so callable by both; each
  -- answers only a yes or no.
  REVOKE ALL ON FUNCTION public.flux_is_shadowed(uuid) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.flux_is_shadowed(uuid) TO anon, authenticated;
  REVOKE ALL ON FUNCTION public.flux_site_read_only() FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.flux_site_read_only() TO anon, authenticated, authenticator;
END $$;
