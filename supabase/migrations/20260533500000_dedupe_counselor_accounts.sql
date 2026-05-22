-- Dedupe IAE counselor accounts: remove demo placeholders (bernstein@school.edu / phelps@school.edu)
-- and merge auto-provisioned duplicates onto canonical Bloomfield rows.
-- No TEMP tables (Supabase SQL editor may split statements across sessions).

DO $$
DECLARE
  m RECORD;
  canon_id UUID;
  dup_id UUID;
  keep_user_id UUID;
BEGIN
  FOR m IN
    SELECT *
    FROM (VALUES
      ('bernstein@school.edu'::text, 'wbernstein@bloomfield.org'::text, 'Whitney Bernstein'::text),
      ('phelps@school.edu', 'aphelps@bloomfield.org', 'Alexandria Phelps')
    ) AS t(placeholder_email, canonical_email, canonical_name)
  LOOP
    canon_id := NULL;

    SELECT c.id INTO canon_id
    FROM public.counselors c
    WHERE c.active = true
      AND lower(trim(coalesce(c.email, ''))) = lower(trim(m.canonical_email))
    ORDER BY (c.user_id IS NOT NULL) DESC, c.id
    LIMIT 1;

    IF canon_id IS NULL THEN
      SELECT c.id INTO canon_id
      FROM public.counselors c
      WHERE lower(trim(coalesce(c.email, ''))) = lower(trim(m.placeholder_email))
      ORDER BY c.id
      LIMIT 1;

      IF canon_id IS NOT NULL THEN
        UPDATE public.counselors
        SET email = m.canonical_email,
            name = m.canonical_name,
            active = true,
            booking_enabled = true
        WHERE id = canon_id;
      ELSE
        INSERT INTO public.counselors (name, email, avatar_initial, active, booking_enabled)
        VALUES (
          m.canonical_name,
          m.canonical_email,
          upper(left(m.canonical_name, 1)),
          true,
          true
        )
        RETURNING id INTO canon_id;
      END IF;
    END IF;

    SELECT c.user_id INTO keep_user_id
    FROM public.counselors c
    WHERE c.id IN (
      SELECT x.id
      FROM public.counselors x
      WHERE x.user_id IS NOT NULL
        AND (
          lower(trim(coalesce(x.email, ''))) IN (lower(trim(m.placeholder_email)), lower(trim(m.canonical_email)))
          OR x.name IN ('Mrs. Bernstein', 'Mrs. Phelps', m.canonical_name)
        )
    )
    ORDER BY (lower(trim(coalesce(c.email, ''))) = lower(trim(m.canonical_email))) DESC
    LIMIT 1;

    UPDATE public.counselors c
    SET name = m.canonical_name,
        email = m.canonical_email,
        user_id = COALESCE(c.user_id, keep_user_id),
        availability = COALESCE(c.availability, src.availability),
        bio = COALESCE(c.bio, src.bio),
        avatar_color = COALESCE(c.avatar_color, src.avatar_color),
        avatar_initial = COALESCE(c.avatar_initial, src.avatar_initial),
        active = true,
        booking_enabled = true
    FROM (
      SELECT availability, bio, avatar_color, avatar_initial
      FROM public.counselors
      WHERE id IN (
        SELECT x.id
        FROM public.counselors x
        WHERE x.id <> canon_id
          AND (
            lower(trim(coalesce(x.email, ''))) IN (lower(trim(m.placeholder_email)), lower(trim(m.canonical_email)))
            OR x.name IN ('Mrs. Bernstein', 'Mrs. Phelps')
          )
      )
      ORDER BY (availability IS NOT NULL) DESC, id
      LIMIT 1
    ) src
    WHERE c.id = canon_id;

    FOR dup_id IN
      SELECT c.id
      FROM public.counselors c
      WHERE c.id <> canon_id
        AND (
          lower(trim(coalesce(c.email, ''))) IN (lower(trim(m.placeholder_email)), lower(trim(m.canonical_email)))
          OR c.name IN ('Mrs. Bernstein', 'Mrs. Phelps')
          OR (
            keep_user_id IS NOT NULL
            AND c.user_id = keep_user_id
          )
        )
    LOOP
      UPDATE public.student_counselors SET counselor_id = canon_id WHERE counselor_id = dup_id;

      UPDATE public.counselor_appointments ca
      SET counselor_id = canon_id
      WHERE ca.counselor_id = dup_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.counselor_appointments x
          WHERE x.counselor_id = canon_id
            AND x.date = ca.date
            AND x.time_slot = ca.time_slot
            AND x.status IS NOT DISTINCT FROM ca.status
        );
      DELETE FROM public.counselor_appointments WHERE counselor_id = dup_id;

      UPDATE public.counselor_availability_slots cas
      SET counselor_id = canon_id
      WHERE cas.counselor_id = dup_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.counselor_availability_slots x
          WHERE x.counselor_id = canon_id
            AND x.day_of_week = cas.day_of_week
            AND x.time_slot = cas.time_slot
        );
      DELETE FROM public.counselor_availability_slots WHERE counselor_id = dup_id;

      IF to_regclass('public.counselor_copilot_audit') IS NOT NULL THEN
        UPDATE public.counselor_copilot_audit SET counselor_id = canon_id WHERE counselor_id = dup_id;
      END IF;
      IF to_regclass('public.counselor_consent_audit') IS NOT NULL THEN
        UPDATE public.counselor_consent_audit SET counselor_id = canon_id WHERE counselor_id = dup_id;
      END IF;
      IF to_regclass('public.student_counselor_checkins') IS NOT NULL THEN
        UPDATE public.student_counselor_checkins SET counselor_id = canon_id WHERE counselor_id = dup_id;
      END IF;

      DELETE FROM public.counselors WHERE id = dup_id;
    END LOOP;
  END LOOP;
END $$;

UPDATE public.staff_directory sd
SET active = false
WHERE sd.active = true
  AND lower(trim(coalesce(sd.school_email, ''))) IN ('bernstein@school.edu', 'phelps@school.edu')
  AND EXISTS (
    SELECT 1
    FROM public.staff_directory live
    WHERE live.active = true
      AND live.role = 'counselor'
      AND lower(trim(coalesce(live.school_email, ''))) IN (
        'wbernstein@bloomfield.org',
        'aphelps@bloomfield.org'
      )
  );

CREATE UNIQUE INDEX IF NOT EXISTS counselors_email_active_key
  ON public.counselors (lower(trim(email)))
  WHERE active = true
    AND email IS NOT NULL
    AND length(trim(email)) > 0;
