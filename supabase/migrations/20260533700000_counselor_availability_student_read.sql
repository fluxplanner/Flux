-- Counselor availability: normalize day keys, backfill slots from JSON, tighten student read RLS.
-- Reversible: policies can be restored; data normalization is safe (lowercase only).

-- 1) Lowercase day_of_week on slot rows (CHECK already requires monday–friday)
UPDATE public.counselor_availability_slots
SET day_of_week = lower(trim(day_of_week))
WHERE day_of_week IS DISTINCT FROM lower(trim(day_of_week));

-- 2) Lowercase keys on counselors.availability JSON (fixes Monday vs monday client mismatch)
UPDATE public.counselors c
SET availability = sub.norm
FROM (
  SELECT
    c2.id,
    COALESCE(
      (
        SELECT jsonb_object_agg(lower(trim(e.key)), e.value)
        FROM jsonb_each(c2.availability) AS e(key, value)
      ),
      '{}'::jsonb
    ) AS norm
  FROM public.counselors c2
  WHERE c2.availability IS NOT NULL
    AND jsonb_typeof(c2.availability) = 'object'
) AS sub
WHERE c.id = sub.id
  AND c.availability IS NOT NULL
  AND jsonb_typeof(c.availability) = 'object'
  AND c.availability IS DISTINCT FROM sub.norm;

-- 3) Backfill slot rows from JSON where missing (onboarding / legacy JSON-only saves)
INSERT INTO public.counselor_availability_slots (counselor_id, day_of_week, time_slot, is_available)
SELECT
  c.id,
  lower(trim(day.key::text, '"')),
  trim(both '"' from slot.value::text),
  true
FROM public.counselors c
CROSS JOIN LATERAL jsonb_each(c.availability) AS day(key, value)
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE WHEN jsonb_typeof(day.value) = 'array' THEN day.value ELSE '[]'::jsonb END
) AS slot(value)
WHERE c.active IS NOT DISTINCT FROM true
  AND c.availability IS NOT NULL
  AND jsonb_typeof(c.availability) = 'object'
  AND lower(trim(day.key::text, '"')) IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday')
ON CONFLICT (counselor_id, day_of_week, time_slot) DO NOTHING;

-- 4) Student booking read: available slots for active counselors only
DROP POLICY IF EXISTS "cas_public_read" ON public.counselor_availability_slots;
CREATE POLICY "cas_public_read" ON public.counselor_availability_slots
  FOR SELECT TO authenticated
  USING (
    is_available = true
    AND counselor_id IN (
      SELECT id FROM public.counselors WHERE active IS NOT DISTINCT FROM true
    )
  );
