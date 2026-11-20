-- Close email-based counselor claims, device-ban bypasses and message floods.
DROP POLICY IF EXISTS counselors_claim_email ON public.counselors;
DROP POLICY IF EXISTS cas_email_match_all ON public.counselor_availability_slots;

CREATE OR REPLACE FUNCTION public.ensure_counselor_profile()
RETURNS counselors LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.counselors;
  v_name text;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_uid AND ur.role = 'counselor') THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_row FROM public.counselors WHERE user_id = v_uid ORDER BY active DESC, id LIMIT 1;
  IF FOUND THEN
    IF NOT v_row.active THEN
      UPDATE public.counselors SET active = true, booking_enabled = true WHERE id = v_row.id RETURNING * INTO v_row;
    END IF;
    RETURN v_row;
  END IF;
  SELECT coalesce(nullif(trim(ur.display_name), ''), 'Counselor') INTO v_name FROM public.user_roles ur WHERE ur.user_id = v_uid;
  INSERT INTO public.counselors (user_id, name, avatar_initial, availability, booking_enabled, active)
  VALUES (v_uid, left(v_name, 120), upper(left(regexp_replace(v_name, '[^A-Za-z0-9]', '', 'g'), 1)),
    '{"monday":["9:00 AM","2:00 PM"],"tuesday":["9:00 AM","2:00 PM"],"wednesday":["9:00 AM","2:00 PM"],"thursday":["9:00 AM","2:00 PM"],"friday":["9:00 AM","2:00 PM"]}'::jsonb, true, true)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$function$;

CREATE OR REPLACE FUNCTION public.save_counselor_availability(p_counselor_id uuid, p_availability jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_day text;
  v_times jsonb;
  v_t text;
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;
  SELECT user_id INTO v_owner FROM public.counselors WHERE id = p_counselor_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF v_owner IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'not allowed to edit this counselor''s availability' USING ERRCODE = '42501';
  END IF;
  UPDATE public.counselors SET availability = p_availability WHERE id = p_counselor_id;
  DELETE FROM public.counselor_availability_slots WHERE counselor_id = p_counselor_id;
  FOR v_day, v_times IN SELECT key, value FROM jsonb_each(coalesce(p_availability, '{}'::jsonb)) LOOP
    v_day := lower(trim(v_day));
    IF v_day NOT IN ('monday','tuesday','wednesday','thursday','friday') THEN CONTINUE; END IF;
    IF jsonb_typeof(v_times) <> 'array' THEN CONTINUE; END IF;
    FOR v_t IN SELECT jsonb_array_elements_text(v_times) LOOP
      IF trim(v_t) = '' THEN CONTINUE; END IF;
      INSERT INTO public.counselor_availability_slots (counselor_id, day_of_week, time_slot, is_available, updated_at)
      VALUES (p_counselor_id, v_day, trim(v_t), true, now())
      ON CONFLICT (counselor_id, day_of_week, time_slot) DO UPDATE SET is_available = true, updated_at = now();
    END LOOP;
  END LOOP;
  RETURN true;
END;
$function$;

DROP TRIGGER IF EXISTS flux_block_reserved_signup ON auth.users;
CREATE TRIGGER flux_block_reserved_signup
  BEFORE INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.flux_block_reserved_signup();

DROP POLICY IF EXISTS flux_claim_educators_only ON public.staff_directory;
CREATE POLICY flux_claim_educators_only ON public.staff_directory
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.flux_caller_is_educator()) WITH CHECK (public.flux_caller_is_educator());

-- The device id is whatever the browser says, so a device ban also bans every
-- account seen on it, and those bans survive a changed id.
CREATE OR REPLACE FUNCTION public.flux_device_ban_cascade()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.kind = 'device' AND NEW.active THEN
    INSERT INTO public.flux_bans (kind, value, reason, created_by)
    SELECT DISTINCT 'user', s.user_id::text, 'Used banned device ' || NEW.value, NEW.created_by
    FROM public.flux_user_sightings s
    WHERE s.device_id = NEW.value AND s.user_id NOT IN (SELECT pa.user_id FROM public.platform_admins pa WHERE pa.user_id IS NOT NULL)
    ON CONFLICT (kind, value) WHERE active DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS flux_device_ban_cascade ON public.flux_bans;
CREATE TRIGGER flux_device_ban_cascade AFTER INSERT ON public.flux_bans
  FOR EACH ROW EXECUTE FUNCTION public.flux_device_ban_cascade();

CREATE OR REPLACE FUNCTION public.flux_device_checkin(p_device text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ip text := coalesce(public.flux_request_ip(), '');
  v_device text := lower(trim(coalesce(p_device, '')));
  h jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
BEGIN
  IF v_uid IS NULL OR public.flux_is_platform_admin() THEN
    RETURN jsonb_build_object('banned', false);
  END IF;
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
  IF EXISTS (SELECT 1 FROM public.flux_bans b WHERE b.active AND b.kind = 'device' AND b.value = v_device) THEN
    INSERT INTO public.flux_bans (kind, value, reason)
    VALUES ('user', v_uid::text, 'Signed in on banned device ' || v_device)
    ON CONFLICT (kind, value) WHERE active DO NOTHING;
    RETURN jsonb_build_object('banned', true);
  END IF;
  RETURN jsonb_build_object('banned', false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.flux_message_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF coalesce(auth.role(), '') = 'authenticated' AND NOT public.flux_is_platform_admin() AND (
    SELECT count(*) FROM public.flux_messages m WHERE m.sender_id = auth.uid() AND m.created_at > now() - interval '1 minute'
  ) >= 20 THEN
    RAISE EXCEPTION 'You are sending messages too quickly.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS flux_message_rate_limit ON public.flux_messages;
CREATE TRIGGER flux_message_rate_limit BEFORE INSERT ON public.flux_messages
  FOR EACH ROW EXECUTE FUNCTION public.flux_message_rate_limit();

CREATE OR REPLACE FUNCTION public.flux_owner_find_user(p_username text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_id uuid;
BEGIN
  IF NOT public.flux_is_platform_admin() THEN
    RAISE EXCEPTION 'owner only' USING ERRCODE = '42501';
  END IF;
  SELECT u.id INTO v_id FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_username))
     OR lower(u.email) = lower(trim(p_username)) || '@users.fluxplanner.app'
  LIMIT 1;
  RETURN v_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.flux_owner_find_user(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.flux_owner_find_user(text) TO authenticated;
