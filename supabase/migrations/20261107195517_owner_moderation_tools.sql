-- Moderation tools for the Owner Controls app (owner.html). Additive: nothing
-- here runs unless the owner uses it, except the expiry check in the two ban
-- functions and the posting rules, which only act on a mute or a lockdown.
--
--   · Bans can expire, and a new kind, 'mute', stops someone posting publicly
--     while leaving the rest of Flux working for them.
--   · Posting lockdown: stops all public posting by everyone but the owner.
--   · flux_mod_actions: warnings and notes on an account. Outlives the account.
--   · Owner-only reads: a summary, one person's file, new accounts, study rooms.
--   · Taking a live public post down. The archive keeps a copy (the delete fires
--     flux_log_public_content), so nothing is lost.
--
-- Undo the enforcement with:
--   DROP TRIGGER flux_posting_rules ON each table listed below;
--   DELETE FROM public.platform_settings WHERE key = 'posting_lockdown';

ALTER TABLE public.flux_bans ADD COLUMN IF NOT EXISTS expires_at timestamptz;
ALTER TABLE public.flux_bans DROP CONSTRAINT IF EXISTS flux_bans_kind_check;
ALTER TABLE public.flux_bans ADD CONSTRAINT flux_bans_kind_check
  CHECK (kind IN ('user', 'ip', 'device', 'mute'));

-- Same as the live function, plus the expiry check.
CREATE OR REPLACE FUNCTION public.flux_check_request()
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_banned boolean := false;
BEGIN
  BEGIN
    IF coalesce(auth.role(), '') = 'service_role' OR public.flux_is_platform_admin() THEN
      RETURN;
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM public.flux_bans b
      WHERE b.active AND (b.expires_at IS NULL OR b.expires_at > now()) AND (
        (b.kind = 'ip' AND b.value = public.flux_request_ip())
        OR (b.kind = 'user' AND b.value = auth.uid()::text)
      )
    ) INTO v_banned;
  EXCEPTION WHEN others THEN
    -- A fault in the ban lookup must never take the whole planner down.
    RETURN;
  END;
  IF v_banned THEN
    RAISE SQLSTATE 'PT403' USING MESSAGE = 'flux_banned';
  END IF;
END;
$function$;

-- Same as the live function, plus the expiry check. An expired row still counts
-- as active for the one-active-ban-per-value index, so it is retired first: the
-- ON CONFLICT below would otherwise swallow a real new ban.
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
BEGIN
  IF v_uid IS NULL OR public.flux_is_platform_admin() THEN
    RETURN jsonb_build_object('banned', false);
  END IF;
  -- A strange id is still recorded, marked, so the address is never lost.
  IF v_device !~ '^[a-f0-9-]{16,64}$' THEN
    v_device := 'invalid';
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
    RETURN jsonb_build_object('banned', true);
  END IF;
  RETURN jsonb_build_object('banned', false);
END;
$function$;

-- Banning something already banned replaces the old terms, so shortening,
-- lengthening or re-banning after an expiry all work the same way.
CREATE OR REPLACE FUNCTION public.flux_owner_ban(
  p_kind text, p_value text, p_label text DEFAULT NULL, p_reason text DEFAULT NULL, p_expires timestamptz DEFAULT NULL
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
  INSERT INTO public.flux_bans (kind, value, label, reason, created_by, expires_at)
  VALUES (p_kind, p_value, p_label, p_reason, auth.uid(), p_expires)
  ON CONFLICT (kind, value) WHERE active DO UPDATE SET
    label = coalesce(EXCLUDED.label, flux_bans.label),
    reason = coalesce(EXCLUDED.reason, flux_bans.reason),
    created_by = EXCLUDED.created_by,
    created_at = now(),
    expires_at = EXCLUDED.expires_at
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;

CREATE TABLE IF NOT EXISTS public.flux_mod_actions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- No foreign key on purpose: these rows must outlive a deleted account.
  user_id uuid,
  kind text NOT NULL,
  detail text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flux_mod_actions_user ON public.flux_mod_actions (user_id, created_at DESC);
ALTER TABLE public.flux_mod_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS flux_mod_actions_owner ON public.flux_mod_actions;
CREATE POLICY flux_mod_actions_owner ON public.flux_mod_actions FOR ALL TO authenticated
  USING (public.flux_is_platform_admin()) WITH CHECK (public.flux_is_platform_admin());
REVOKE ALL ON public.flux_mod_actions FROM anon;
GRANT SELECT, INSERT ON public.flux_mod_actions TO authenticated;

-- The owner's posts, and anything the service role writes, pass. So does an
-- update that changes nothing but a like count: students liking a feed post is
-- not posting. The messages are what a blocked person sees, so they are in words.
CREATE OR REPLACE FUNCTION public.flux_enforce_posting_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_locked boolean := false;
  v_muted boolean := false;
BEGIN
  BEGIN
    IF auth.uid() IS NULL OR public.flux_is_platform_admin() THEN
      RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'likes_count') = (to_jsonb(OLD) - 'likes_count') THEN
      RETURN NEW;
    END IF;
    SELECT coalesce((s.value->>'on')::boolean, false) INTO v_locked
      FROM public.platform_settings s WHERE s.key = 'posting_lockdown';
    SELECT EXISTS (
      SELECT 1 FROM public.flux_bans b
      WHERE b.active AND b.kind = 'mute' AND b.value = auth.uid()::text
        AND (b.expires_at IS NULL OR b.expires_at > now())
    ) INTO v_muted;
  EXCEPTION WHEN others THEN
    -- A fault in this lookup must never stop a teacher posting.
    RETURN NEW;
  END;
  IF coalesce(v_locked, false) THEN
    RAISE EXCEPTION 'Posting is paused across Flux right now. Try again later.' USING ERRCODE = '42501';
  END IF;
  IF v_muted THEN
    RAISE EXCEPTION 'Posting is turned off for this account.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['school_feed', 'school_announcements', 'teacher_announcements',
                           'teacher_assignments', 'no_homework_days', 'flux_school_broadcast'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS flux_posting_rules ON public.%I', t);
    EXECUTE format('CREATE TRIGGER flux_posting_rules BEFORE INSERT OR UPDATE ON public.%I '
                   'FOR EACH ROW EXECUTE FUNCTION public.flux_enforce_posting_rules()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.flux_owner_set_lockdown(p_on boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb := jsonb_build_object('on', coalesce(p_on, false), 'changed_at', now());
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.platform_settings (key, value, updated_at, updated_by)
  VALUES ('posting_lockdown', v, now(), 'owner controls')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by;
  INSERT INTO public.flux_mod_actions (kind, detail, created_by)
  VALUES ('lockdown', CASE WHEN p_on THEN 'Posting paused for everyone' ELSE 'Posting allowed again' END, auth.uid());
  RETURN v;
END;
$function$;

-- Only these can be taken down, each by its own key. The source name comes from
-- the browser, so it is checked against this list before it reaches any SQL.
CREATE OR REPLACE FUNCTION public.flux_owner_remove_content(p_source text, p_id text, p_reason text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
  v_author uuid;
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  IF p_source IN ('school_feed', 'school_announcements', 'teacher_announcements',
                  'teacher_assignments', 'no_homework_days', 'flux_study_rooms') THEN
    EXECUTE format('DELETE FROM public.%I WHERE id = $1::uuid', p_source) USING p_id;
  ELSIF p_source = 'flux_school_broadcast' THEN
    DELETE FROM public.flux_school_broadcast WHERE school_slug = p_id;
  ELSE
    RAISE EXCEPTION 'that kind of post cannot be taken down here' USING ERRCODE = '22023';
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  SELECT l.author_id INTO v_author FROM public.flux_public_content_log l
    WHERE l.source = p_source AND l.source_id = p_id AND l.action = 'INSERT'
    ORDER BY l.created_at DESC LIMIT 1;
  IF v_count > 0 THEN
    INSERT INTO public.flux_mod_actions (user_id, kind, detail, created_by)
    VALUES (v_author, 'takedown', p_source || ' ' || p_id || coalesce(': ' || p_reason, ''), auth.uid());
  END IF;
  RETURN v_count;
END;
$function$;

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
    'bans', (SELECT count(*) FROM public.flux_bans b WHERE b.active AND b.kind <> 'mute' AND (b.expires_at IS NULL OR b.expires_at > now())),
    'mutes', (SELECT count(*) FROM public.flux_bans b WHERE b.active AND b.kind = 'mute' AND (b.expires_at IS NULL OR b.expires_at > now())),
    'posts_24h', (SELECT count(*) FROM public.flux_public_content_log l WHERE l.created_at > now() - interval '24 hours' AND l.source <> 'platform_settings'),
    'active_24h', (SELECT count(DISTINCT s.user_id) FROM public.flux_user_sightings s WHERE s.last_seen > now() - interval '24 hours'),
    'shared_ips', (SELECT count(*) FROM (SELECT s.ip FROM public.flux_user_sightings s WHERE s.ip <> '' GROUP BY s.ip HAVING count(DISTINCT s.user_id) > 1) x),
    'new_accounts_7d', (SELECT count(*) FROM auth.users u WHERE u.created_at > now() - interval '7 days'),
    'accounts', (SELECT count(*) FROM auth.users),
    'password_help', (SELECT count(*) FROM public.flux_password_help p WHERE NOT coalesce(p.handled, false)),
    'staff_waiting', (SELECT count(*) FROM public.staff_verification_requests r WHERE r.verification_status = 'pending'),
    'rooms_open', (SELECT count(*) FROM public.flux_study_rooms r WHERE r.active),
    'lockdown', coalesce((SELECT (s.value->>'on')::boolean FROM public.platform_settings s WHERE s.key = 'posting_lockdown'), false)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.flux_owner_person(p_user uuid)
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
    'user_id', p_user,
    'account', (SELECT jsonb_build_object(
        'username', split_part(u.email, '@', 1), 'created_at', u.created_at,
        'last_sign_in_at', u.last_sign_in_at, 'banned_until', u.banned_until)
      FROM auth.users u WHERE u.id = p_user),
    'profile', (SELECT jsonb_build_object('display_name', ur.display_name, 'role', ur.role, 'school', ur.school)
      FROM public.user_roles ur WHERE ur.user_id = p_user),
    'sightings', (SELECT coalesce(jsonb_agg(jsonb_build_object(
        'device_id', s.device_id, 'ip', s.ip, 'user_agent', s.user_agent, 'first_seen', s.first_seen, 'last_seen', s.last_seen,
        'accounts_on_ip', (SELECT count(DISTINCT x.user_id) FROM public.flux_user_sightings x WHERE x.ip = s.ip)
      ) ORDER BY s.last_seen DESC), '[]'::jsonb) FROM public.flux_user_sightings s WHERE s.user_id = p_user),
    'posts', (SELECT coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM (
        SELECT l.id, l.source, l.source_id, l.action, l.content, l.created_at
        FROM public.flux_public_content_log l WHERE l.author_id = p_user ORDER BY l.created_at DESC LIMIT 50) p),
    'bans', (SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.created_at DESC), '[]'::jsonb) FROM public.flux_bans b
      WHERE b.value = p_user::text OR b.value IN (SELECT s.ip FROM public.flux_user_sightings s WHERE s.user_id = p_user)
        OR b.value IN (SELECT s.device_id FROM public.flux_user_sightings s WHERE s.user_id = p_user)),
    'actions', (SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC), '[]'::jsonb) FROM public.flux_mod_actions a WHERE a.user_id = p_user),
    'report', (SELECT jsonb_build_object('reason', r.reason, 'saved_at', r.saved_at) FROM public.flux_reported_users r WHERE r.user_id = p_user)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.flux_owner_new_accounts(p_days integer DEFAULT 14)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM (
    SELECT u.id AS user_id, split_part(u.email, '@', 1) AS username, ur.display_name, ur.role,
           u.created_at, u.last_sign_in_at, u.banned_until
    FROM auth.users u LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    WHERE u.created_at > now() - make_interval(days => least(greatest(coalesce(p_days, 14), 1), 365))
    ORDER BY u.created_at DESC LIMIT 200) a), '[]'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION public.flux_owner_study_rooms()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  RETURN coalesce((SELECT jsonb_agg(to_jsonb(a)) FROM (
    SELECT r.id, r.code, r.label, r.class_code, r.school, r.participants, r.active, r.created_at, r.last_seen_at,
           r.host_id, split_part(u.email, '@', 1) AS host_username
    FROM public.flux_study_rooms r LEFT JOIN auth.users u ON u.id = r.host_id
    ORDER BY r.last_seen_at DESC NULLS LAST LIMIT 200) a), '[]'::jsonb);
END;
$function$;

DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'flux_owner_ban(text, text, text, text, timestamptz)',
    'flux_owner_set_lockdown(boolean)',
    'flux_owner_remove_content(text, text, text)',
    'flux_owner_mod_summary()',
    'flux_owner_person(uuid)',
    'flux_owner_new_accounts(integer)',
    'flux_owner_study_rooms()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  -- A trigger function is never called directly, by anyone.
  REVOKE ALL ON FUNCTION public.flux_enforce_posting_rules() FROM PUBLIC, anon, authenticated;
END $$;
