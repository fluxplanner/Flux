-- 24/7 security watch: the data the security-watch edge function reads every
-- 15 minutes and turns into email + Discord alerts.
--
-- Signals:
--   failed_logins  bursts of wrong passwords (reported by the sign-in screen)
--   power_grants   new owner / admin / teacher / counselor / staff roles,
--                  custom-role memberships, platform owner changes
--   rls_missing    any public table without row level security
--   ai_usage       AI proxy allowances close to or past their daily cap
--
-- Failed logins come from the sign-in screen calling flux_note_failed_login.
-- Supabase Auth does not write failures to auth.audit_log_entries on this
-- project, and reading its own logs needs a personal access token with power
-- over the whole account, which is a worse thing to store than the gap it
-- closes. So a script that talks to Supabase Auth directly is not counted
-- here; Supabase's own sign-in rate limit is what stops that.
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.flux_security_scan(integer);
--   DROP FUNCTION IF EXISTS public.flux_security_alert_claim(text, text, integer);
--   DROP FUNCTION IF EXISTS public.flux_note_failed_login(text);
--   DROP TABLE IF EXISTS public.flux_security_alert_state;
--   DROP TABLE IF EXISTS public.flux_failed_logins;

-- ---------------------------------------------------------------- failed logins
CREATE TABLE IF NOT EXISTS public.flux_failed_logins (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  username   text NOT NULL,
  ip         text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS flux_failed_logins_at_idx ON public.flux_failed_logins (created_at);
ALTER TABLE public.flux_failed_logins ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role and the definer functions below touch it.

CREATE OR REPLACE FUNCTION public.flux_note_failed_login(p_username text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip   text := public.flux_request_ip();
  v_name text := lower(left(trim(coalesce(p_username, '')), 80));
BEGIN
  IF v_name = '' THEN RETURN; END IF;
  -- One address cannot flood the table: past 300 an hour it is already an
  -- alert, and more rows would add nothing.
  IF (SELECT count(*) FROM public.flux_failed_logins f
      WHERE f.ip IS NOT DISTINCT FROM v_ip AND f.created_at > now() - interval '1 hour') >= 300 THEN
    RETURN;
  END IF;
  INSERT INTO public.flux_failed_logins (username, ip) VALUES (v_name, v_ip);
  -- Two days is enough for a 15-minute watch and keeps no long trail.
  IF random() < 0.02 THEN
    DELETE FROM public.flux_failed_logins WHERE created_at < now() - interval '2 days';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.flux_note_failed_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_note_failed_login(text) TO anon, authenticated;

-- ---------------------------------------------------------------- alert dedupe
CREATE TABLE IF NOT EXISTS public.flux_security_alert_state (
  signal       text PRIMARY KEY,
  fingerprint  text NOT NULL,
  last_sent_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.flux_security_alert_state ENABLE ROW LEVEL SECURITY;

-- True when this signal should alert now: its fingerprint changed, or the same
-- problem is still there and p_repeat_minutes have passed since the last alert.
-- Records the send in the same statement, so two overlapping runs cannot both
-- claim it.
CREATE OR REPLACE FUNCTION public.flux_security_alert_claim(
  p_signal text, p_fingerprint text, p_repeat_minutes integer DEFAULT 360)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_claimed boolean;
BEGIN
  INSERT INTO public.flux_security_alert_state AS s (signal, fingerprint, last_sent_at)
  VALUES (p_signal, p_fingerprint, now())
  ON CONFLICT (signal) DO UPDATE
    SET fingerprint = EXCLUDED.fingerprint, last_sent_at = now()
    WHERE s.fingerprint IS DISTINCT FROM EXCLUDED.fingerprint
       OR s.last_sent_at < now() - make_interval(mins => p_repeat_minutes)
  RETURNING true INTO v_claimed;
  RETURN coalesce(v_claimed, false);
END;
$$;
REVOKE ALL ON FUNCTION public.flux_security_alert_claim(text, text, integer) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------- the scan
CREATE OR REPLACE FUNCTION public.flux_security_scan(p_minutes integer DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  since timestamptz := now() - make_interval(mins => greatest(5, least(coalesce(p_minutes, 20), 1440)));
  v_failed jsonb; v_grants jsonb; v_rls jsonb; v_ai jsonb;
BEGIN
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM flux_failed_logins WHERE created_at > since),
    'top_usernames', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT username, count(*) n FROM flux_failed_logins WHERE created_at > since
        GROUP BY username ORDER BY n DESC LIMIT 5) x), '[]'::jsonb),
    'top_ips', coalesce((SELECT jsonb_agg(x) FROM (
        SELECT ip, count(*) n, count(DISTINCT username) usernames FROM flux_failed_logins
        WHERE created_at > since GROUP BY ip ORDER BY n DESC LIMIT 5) x), '[]'::jsonb)
  ) INTO v_failed;

  SELECT coalesce(jsonb_agg(x ORDER BY x.id), '[]'::jsonb) INTO v_grants FROM (
    SELECT l.id, l.action_type, l.created_at,
           coalesce(l.new_value->>'role', l.old_value->>'role') AS role,
           l.via,
           l.actor_user_id = 'eabe2b1f-e428-4181-8530-8e5366eb3975'::uuid AS by_owner,
           l.actor_user_id IS NOT NULL AND l.actor_user_id = l.target_user_id AS self_granted,
           (SELECT split_part(u.email, '@', 1) FROM auth.users u WHERE u.id = l.target_user_id) AS target
    FROM flux_admin_action_log l
    WHERE l.created_at > since
      AND (l.action_type IN ('owner_added', 'owner_changed', 'owner_removed')
           OR (l.action_type IN ('role_set', 'role_change')
               AND coalesce(l.new_value->>'role', '') IN ('owner','admin','teacher','counselor','staff')))
    LIMIT 50
  ) x;
  -- Custom roles (owner-made, show hidden apps) have no log row of their own.
  v_grants := v_grants || coalesce((
    SELECT jsonb_agg(jsonb_build_object(
      'action_type', 'custom_role_added', 'created_at', m.added_at, 'role', r.name,
      'target', (SELECT split_part(u.email, '@', 1) FROM auth.users u WHERE u.id = m.user_id)))
    FROM flux_role_members m JOIN flux_roles r ON r.id = m.role_id
    WHERE m.added_at > since), '[]'::jsonb);

  SELECT coalesce(jsonb_agg(c.relname ORDER BY c.relname), '[]'::jsonb) INTO v_rls
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity;

  -- Daily caps by bucket prefix. AI buckets are "user:", "scan:", "guest:",
  -- "guestv:"; the rest are "<function>:<who>".
  SELECT coalesce(jsonb_agg(x ORDER BY x.ratio DESC), '[]'::jsonb) INTO v_ai FROM (
    SELECT split_part(g.bucket, ':', 1) AS kind, g.count,
           cap.v AS cap, round(g.count::numeric / cap.v, 2) AS ratio
    FROM flux_ai_guard g
    CROSS JOIN LATERAL (SELECT CASE split_part(g.bucket, ':', 1)
        WHEN 'user' THEN 300 WHEN 'scan' THEN 40 WHEN 'guest' THEN 20 WHEN 'guestv' THEN 20
        WHEN 'ec-college-chat' THEN 150 WHEN 'user-feedback' THEN 40 WHEN 'account-setup' THEN 30
        WHEN 'stripe-checkout' THEN 20 WHEN 'stripe-portal' THEN 20 WHEN 'schoology-feed' THEN 300
        WHEN 'mcp-register' THEN 20 WHEN 'mcp-token' THEN 300 WHEN 'mcp' THEN 3000
        WHEN 'release-admin' THEN 1500 WHEN 'get-entitlement' THEN 1000
        WHEN 'canvas-proxy' THEN 2000 WHEN 'ical-feed' THEN 2000 ELSE 1000 END AS v) cap
    WHERE g.day = current_date AND g.count >= cap.v * 0.8
    ORDER BY ratio DESC LIMIT 20
  ) x;
  v_ai := jsonb_build_object(
    'near_cap', v_ai,
    'guest_buckets_today', (SELECT count(*) FROM flux_ai_guard
                            WHERE day = current_date AND bucket ~ '^guestv?:'),
    'ai_messages_today', (SELECT coalesce(sum(message_count), 0) FROM ai_usage WHERE date = current_date),
    'ai_messages_7d_avg', (SELECT round(coalesce(sum(message_count), 0) / 7.0, 1) FROM ai_usage
                           WHERE date >= current_date - 7 AND date < current_date));

  RETURN jsonb_build_object('since', since, 'failed_logins', v_failed, 'power_grants', v_grants,
                            'rls_missing', v_rls, 'ai_usage', v_ai);
END;
$$;
REVOKE ALL ON FUNCTION public.flux_security_scan(integer) FROM PUBLIC, anon, authenticated;
