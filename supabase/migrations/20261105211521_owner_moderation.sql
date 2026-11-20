-- Owner moderation, added after the 2026-11-05 incident:
--   · flux_public_content_log: everything posted publicly, by anyone, kept even
--     after the post or its author is deleted.
--   · flux_bans: account, IP and device bans, enforced on every REST request by
--     flux_check_request.
--   · flux_user_sightings: which addresses and devices each account used.
--   · flux_reported_users: saved records that outlive the account.
-- All owner-only. Undo the enforcement with:
--   ALTER ROLE authenticator RESET pgrst.db_pre_request; NOTIFY pgrst, 'reload config';

CREATE OR REPLACE FUNCTION public.flux_request_ip()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $function$
DECLARE
  h jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
BEGIN
  RETURN nullif(trim(coalesce(
    h->>'cf-connecting-ip',
    split_part(coalesce(h->>'x-forwarded-for', ''), ',', 1)
  )), '');
END;
$function$;

CREATE TABLE IF NOT EXISTS public.flux_bans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('user', 'ip', 'device')),
  value text NOT NULL,
  label text,
  reason text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  lifted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS flux_bans_one_active ON public.flux_bans (kind, value) WHERE active;
ALTER TABLE public.flux_bans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS flux_bans_owner ON public.flux_bans;
CREATE POLICY flux_bans_owner ON public.flux_bans FOR ALL TO authenticated
  USING (public.flux_is_platform_admin()) WITH CHECK (public.flux_is_platform_admin());

-- No foreign key on purpose: these rows must outlive a deleted account.
CREATE TABLE IF NOT EXISTS public.flux_user_sightings (
  user_id uuid NOT NULL,
  device_id text NOT NULL,
  ip text NOT NULL DEFAULT '',
  user_agent text,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id, ip)
);
CREATE INDEX IF NOT EXISTS flux_user_sightings_ip ON public.flux_user_sightings (ip);
ALTER TABLE public.flux_user_sightings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS flux_user_sightings_owner_read ON public.flux_user_sightings;
CREATE POLICY flux_user_sightings_owner_read ON public.flux_user_sightings FOR SELECT TO authenticated
  USING (public.flux_is_platform_admin());

CREATE TABLE IF NOT EXISTS public.flux_reported_users (
  user_id uuid PRIMARY KEY,
  username text,
  display_name text,
  reason text,
  notes text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  saved_by uuid,
  saved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flux_reported_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS flux_reported_users_owner ON public.flux_reported_users;
CREATE POLICY flux_reported_users_owner ON public.flux_reported_users FOR ALL TO authenticated
  USING (public.flux_is_platform_admin()) WITH CHECK (public.flux_is_platform_admin());

CREATE TABLE IF NOT EXISTS public.flux_public_content_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source text NOT NULL,
  source_id text,
  action text NOT NULL,
  author_id uuid,
  author_label text,
  author_ip text,
  content jsonb,
  previous jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flux_public_content_log_recent ON public.flux_public_content_log (created_at DESC);
ALTER TABLE public.flux_public_content_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS flux_public_content_log_owner_read ON public.flux_public_content_log;
CREATE POLICY flux_public_content_log_owner_read ON public.flux_public_content_log FOR SELECT TO authenticated
  USING (public.flux_is_platform_admin());

CREATE OR REPLACE FUNCTION public.flux_log_public_content()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row jsonb := to_jsonb(CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END);
  v_prev jsonb := CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END;
  v_author uuid;
  v_label text;
BEGIN
  IF TG_OP = 'UPDATE' AND v_row = v_prev THEN
    RETURN NEW;
  END IF;
  BEGIN
    v_author := coalesce(
      auth.uid(),
      nullif(v_row->>'posted_by', '')::uuid,
      nullif(v_row->>'teacher_id', '')::uuid,
      nullif(v_row->>'created_by', '')::uuid
    );
  EXCEPTION WHEN others THEN
    v_author := auth.uid();
  END;
  SELECT coalesce(nullif(ur.display_name, ''), split_part(u.email, '@', 1))
    INTO v_label
    FROM auth.users u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    WHERE u.id = v_author;
  INSERT INTO public.flux_public_content_log
    (source, source_id, action, author_id, author_label, author_ip, content, previous)
  VALUES (
    TG_TABLE_NAME,
    coalesce(v_row->>'id', v_row->>'key', v_row->>'school_slug'),
    TG_OP,
    v_author,
    coalesce(v_label, v_row->>'updated_by', CASE WHEN auth.role() = 'service_role' THEN 'owner controls' END),
    public.flux_request_ip(),
    v_row,
    v_prev
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
EXCEPTION WHEN others THEN
  -- The archive must never stop someone posting.
  RAISE WARNING 'flux_log_public_content: %', SQLERRM;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$function$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['flux_school_broadcast','school_announcements','school_feed','teacher_announcements','teacher_assignments','no_homework_days','platform_settings','owner_direct_messages'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS flux_log_public_content ON public.%I', t);
    EXECUTE format('CREATE TRIGGER flux_log_public_content AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.flux_log_public_content()', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.flux_device_checkin(p_device text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ip text := coalesce(public.flux_request_ip(), '');
  v_device text := CASE WHEN p_device ~ '^[a-f0-9-]{16,64}$' THEN p_device END;
  h jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
BEGIN
  IF v_uid IS NULL OR v_device IS NULL THEN
    RETURN jsonb_build_object('banned', false);
  END IF;
  IF public.flux_is_platform_admin() THEN
    RETURN jsonb_build_object('banned', false);
  END IF;
  INSERT INTO public.flux_user_sightings (user_id, device_id, ip, user_agent)
  VALUES (v_uid, v_device, v_ip, left(h->>'user-agent', 300))
  ON CONFLICT (user_id, device_id, ip)
    DO UPDATE SET last_seen = now(), user_agent = EXCLUDED.user_agent;
  -- One account cannot grow this table without limit by inventing device ids.
  DELETE FROM public.flux_user_sightings s
  WHERE s.user_id = v_uid AND (s.device_id, s.ip) IN (
    SELECT device_id, ip FROM public.flux_user_sightings
    WHERE user_id = v_uid ORDER BY last_seen DESC OFFSET 25
  );
  IF EXISTS (SELECT 1 FROM public.flux_bans b WHERE b.active AND b.kind = 'device' AND b.value = v_device) THEN
    INSERT INTO public.flux_bans (kind, value, reason)
    VALUES ('user', v_uid::text, 'Signed in on banned device ' || v_device)
    ON CONFLICT (kind, value) WHERE active DO NOTHING;
    RETURN jsonb_build_object('banned', true);
  END IF;
  RETURN jsonb_build_object('banned', false);
END;
$function$;
REVOKE ALL ON FUNCTION public.flux_device_checkin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_device_checkin(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.flux_owner_user_intel()
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
      'user_id', s.user_id,
      'username', split_part(u.email, '@', 1),
      'display_name', ur.display_name,
      'role', ur.role,
      'deleted', u.id IS NULL,
      'device_id', s.device_id,
      'ip', s.ip,
      'accounts_on_ip', (SELECT count(DISTINCT x.user_id) FROM public.flux_user_sightings x WHERE x.ip = s.ip),
      'user_agent', s.user_agent,
      'last_seen', s.last_seen
    ) ORDER BY s.last_seen DESC)
    FROM public.flux_user_sightings s
    LEFT JOIN auth.users u ON u.id = s.user_id
    LEFT JOIN public.user_roles ur ON ur.user_id = s.user_id
  ), '[]'::jsonb);
END;
$function$;
REVOKE ALL ON FUNCTION public.flux_owner_user_intel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_owner_user_intel() TO authenticated;

CREATE OR REPLACE FUNCTION public.flux_owner_save_report(p_user uuid, p_reason text DEFAULT NULL, p_notes text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_snapshot jsonb;
  v_username text;
  v_display text;
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  SELECT split_part(u.email, '@', 1) INTO v_username FROM auth.users u WHERE u.id = p_user;
  SELECT ur.display_name INTO v_display FROM public.user_roles ur WHERE ur.user_id = p_user;
  v_snapshot := jsonb_build_object(
    'saved_at', now(),
    'account', (SELECT jsonb_build_object('email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at) FROM auth.users u WHERE u.id = p_user),
    'profile', (SELECT to_jsonb(ur) FROM public.user_roles ur WHERE ur.user_id = p_user),
    'sightings', (SELECT coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) FROM public.flux_user_sightings s WHERE s.user_id = p_user),
    'public_content', (SELECT coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) FROM public.flux_public_content_log l WHERE l.author_id = p_user)
  );
  INSERT INTO public.flux_reported_users (user_id, username, display_name, reason, notes, snapshot, saved_by)
  VALUES (p_user, v_username, v_display, p_reason, p_notes, v_snapshot, auth.uid())
  ON CONFLICT (user_id) DO UPDATE SET
    username = coalesce(EXCLUDED.username, flux_reported_users.username),
    display_name = coalesce(EXCLUDED.display_name, flux_reported_users.display_name),
    reason = coalesce(EXCLUDED.reason, flux_reported_users.reason),
    notes = coalesce(EXCLUDED.notes, flux_reported_users.notes),
    snapshot = EXCLUDED.snapshot,
    saved_at = now();
  RETURN v_snapshot;
END;
$function$;
REVOKE ALL ON FUNCTION public.flux_owner_save_report(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_owner_save_report(uuid, text, text) TO authenticated;

-- flux_check_request runs before every REST request. A fault in the lookup lets
-- the request through rather than taking the whole planner down.
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
      WHERE b.active AND (
        (b.kind = 'ip' AND b.value = public.flux_request_ip())
        OR (b.kind = 'user' AND b.value = auth.uid()::text)
      )
    ) INTO v_banned;
  EXCEPTION WHEN others THEN
    RETURN;
  END;
  IF v_banned THEN
    RAISE SQLSTATE 'PT403' USING MESSAGE = 'flux_banned';
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.flux_check_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_check_request() TO anon, authenticated, service_role, authenticator;

ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.flux_check_request';
NOTIFY pgrst, 'reload config';
