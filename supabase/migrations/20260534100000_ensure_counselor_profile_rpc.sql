-- Link auth users to public.counselors (claim directory row, reactivate, or insert).
-- Fixes "Counselor record not found" when JWT email ≠ school email (e.g. personal Gmail vs aphelps@bloomfield.org).

CREATE OR REPLACE FUNCTION public.ensure_counselor_profile()
RETURNS public.counselors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  jwt_email text := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  school_email text;
  row public.counselors;
  disp text;
  letter text;
BEGIN
  IF uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF jwt_email = 'azfermohammed21@gmail.com' THEN
    RETURN NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE lower(trim(coalesce(pa.email, ''))) = jwt_email
  ) THEN
    RETURN NULL;
  END IF;

  SELECT c.* INTO row
  FROM public.counselors c
  WHERE c.user_id = uid AND c.active = true
  ORDER BY c.id
  LIMIT 1;
  IF FOUND THEN
    RETURN row;
  END IF;

  SELECT c.* INTO row
  FROM public.counselors c
  WHERE c.user_id = uid
  ORDER BY c.active DESC NULLS LAST, c.id
  LIMIT 1;
  IF FOUND THEN
    UPDATE public.counselors
    SET active = true, booking_enabled = true, user_id = uid
    WHERE id = row.id
    RETURNING * INTO row;
    RETURN row;
  END IF;

  school_email := NULLIF(jwt_email, '');
  SELECT lower(trim(coalesce(sd.school_email, ''))) INTO school_email
  FROM public.staff_directory sd
  WHERE sd.claimed_by = uid
    AND sd.role = 'counselor'
    AND sd.active = true
    AND sd.school_email IS NOT NULL
    AND length(trim(sd.school_email)) > 0
  ORDER BY sd.claimed_at DESC NULLS LAST, sd.id
  LIMIT 1;

  IF school_email IS NULL OR school_email = '' THEN
    SELECT lower(trim(coalesce(svr.school_email, ''))) INTO school_email
    FROM public.staff_verification_requests svr
    WHERE svr.user_id = uid
      AND svr.school_email IS NOT NULL
      AND length(trim(svr.school_email)) > 0
    LIMIT 1;
  END IF;

  IF school_email IS NULL OR school_email = '' THEN
    school_email := jwt_email;
  END IF;

  SELECT c.* INTO row
  FROM public.counselors c
  WHERE c.user_id IS NULL
    AND c.active = true
    AND c.email IS NOT NULL
    AND lower(trim(c.email)) IN (school_email, jwt_email)
  ORDER BY (lower(trim(c.email)) = school_email) DESC, c.id
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.counselors
    SET user_id = uid
    WHERE id = row.id
    RETURNING * INTO row;
    RETURN row;
  END IF;

  SELECT coalesce(nullif(trim(ur.display_name), ''), 'Counselor') INTO disp
  FROM public.user_roles ur
  WHERE ur.user_id = uid
  LIMIT 1;
  IF disp IS NULL OR length(trim(disp)) = 0 THEN
    disp := 'Counselor';
  END IF;

  letter := upper(left(regexp_replace(disp, '[^A-Za-z0-9]', '', 'g'), 1));
  IF letter IS NULL OR letter = '' THEN
    letter := 'C';
  END IF;

  BEGIN
    INSERT INTO public.counselors (
      user_id,
      name,
      email,
      avatar_initial,
      availability,
      booking_enabled,
      active
    )
    VALUES (
      uid,
      left(trim(disp), 120),
      NULLIF(school_email, ''),
      letter,
      '{
        "monday": ["9:00 AM", "2:00 PM"],
        "tuesday": ["9:00 AM", "2:00 PM"],
        "wednesday": ["9:00 AM", "2:00 PM"],
        "thursday": ["9:00 AM", "2:00 PM"],
        "friday": ["9:00 AM", "2:00 PM"]
      }'::jsonb,
      true,
      true
    )
    RETURNING * INTO row;
    RETURN row;
  EXCEPTION
    WHEN unique_violation THEN
      SELECT c.* INTO row FROM public.counselors c WHERE c.user_id = uid LIMIT 1;
      IF FOUND THEN
        RETURN row;
      END IF;
      SELECT c.* INTO row
      FROM public.counselors c
      WHERE c.active = true
        AND lower(trim(coalesce(c.email, ''))) = school_email
      ORDER BY c.id
      LIMIT 1;
      IF FOUND AND row.user_id IS NULL THEN
        UPDATE public.counselors SET user_id = uid WHERE id = row.id RETURNING * INTO row;
        RETURN row;
      END IF;
      RETURN NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_counselor_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_counselor_profile() TO authenticated;
