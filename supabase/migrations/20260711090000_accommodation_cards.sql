-- C5 — Accommodation Cards (flag enable_accommodation_cards).
--
-- Counselor-managed accommodations that surface privacy-safely to teachers:
--   - counselors (same school) create/edit; students see their own rows
--     (transparency panel) — teachers have NO direct table access
--   - teachers get AGGREGATE kind chips for their own roster only, via a
--     SECURITY DEFINER RPC (no notes, no names)
--   - per-student detail requires the accommodation to be consent-shared
--     (consent_state = 'staff_visible', set with the student per the
--     P4-CONSENT framework) and every detail view writes an audit row
--     (P4-COUNSELOR-AI audit pattern)
--
-- School model: user_roles.school TEXT (house pattern, see C2 migration).
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.flux_teacher_accommodation_details(text);
--   DROP FUNCTION IF EXISTS public.flux_teacher_accommodation_chips(text);
--   DROP TABLE IF EXISTS public.flux_accommodation_audit;
--   DROP TABLE IF EXISTS public.flux_student_accommodations;
--   DELETE FROM public.flux_feature_flags WHERE key = 'enable_accommodation_cards';

CREATE TABLE IF NOT EXISTS public.flux_student_accommodations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school        TEXT NOT NULL,
  kind          TEXT NOT NULL,
  note          TEXT,
  consent_state TEXT NOT NULL DEFAULT 'private'
                CHECK (consent_state IN ('private', 'staff_visible')),
  created_by    UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accommodations_student
  ON public.flux_student_accommodations(student_id);
CREATE INDEX IF NOT EXISTS idx_accommodations_school
  ON public.flux_student_accommodations(lower(trim(school)));

CREATE TABLE IF NOT EXISTS public.flux_accommodation_audit (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accommodation_id UUID NOT NULL REFERENCES public.flux_student_accommodations(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL,
  viewer_id        UUID NOT NULL,
  action           TEXT NOT NULL DEFAULT 'detail_view',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_accommodation_audit_student
  ON public.flux_accommodation_audit(student_id, created_at DESC);

ALTER TABLE public.flux_student_accommodations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flux_accommodation_audit ENABLE ROW LEVEL SECURITY;

-- Counselors write within their school.
DROP POLICY IF EXISTS "accommodations_counselor_all" ON public.flux_student_accommodations;
CREATE POLICY "accommodations_counselor_all" ON public.flux_student_accommodations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles me
      WHERE me.user_id = auth.uid()
        AND me.role = 'counselor'
        AND NULLIF(trim(me.school), '') IS NOT NULL
        AND lower(trim(me.school)) = lower(trim(flux_student_accommodations.school))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles me
      WHERE me.user_id = auth.uid()
        AND me.role = 'counselor'
        AND NULLIF(trim(me.school), '') IS NOT NULL
        AND lower(trim(me.school)) = lower(trim(flux_student_accommodations.school))
    )
  );

-- Students see their own rows (Settings transparency panel).
DROP POLICY IF EXISTS "accommodations_student_select" ON public.flux_student_accommodations;
CREATE POLICY "accommodations_student_select" ON public.flux_student_accommodations
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

-- Audit: students read their own trail; counselors read within school.
-- Inserts happen only inside the SECURITY DEFINER detail RPC.
DROP POLICY IF EXISTS "accommodation_audit_student_select" ON public.flux_accommodation_audit;
CREATE POLICY "accommodation_audit_student_select" ON public.flux_accommodation_audit
  FOR SELECT TO authenticated
  USING (student_id = auth.uid());

DROP POLICY IF EXISTS "accommodation_audit_counselor_select" ON public.flux_accommodation_audit;
CREATE POLICY "accommodation_audit_counselor_select" ON public.flux_accommodation_audit
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles me
      JOIN public.flux_student_accommodations a ON a.id = flux_accommodation_audit.accommodation_id
      WHERE me.user_id = auth.uid()
        AND me.role = 'counselor'
        AND NULLIF(trim(me.school), '') IS NOT NULL
        AND lower(trim(me.school)) = lower(trim(a.school))
    )
  );

-- AGGREGATE chips for the caller's own class: kind + count only.
-- Includes private rows by design — the teacher learns "2 students need
-- extended time" without learning who; names/notes never leave this RPC.
CREATE OR REPLACE FUNCTION public.flux_teacher_accommodation_chips(p_class_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM teacher_classes tc
    WHERE tc.class_code = p_class_code AND tc.teacher_id = auth.uid() AND tc.active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_your_class');
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('kind', kind, 'n', n) ORDER BY n DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT a.kind, count(DISTINCT a.student_id) AS n
    FROM flux_student_accommodations a
    JOIN teacher_students ts
      ON ts.student_id = a.student_id
     AND ts.class_code = p_class_code
     AND ts.teacher_id = auth.uid()
     AND ts.active = true
    GROUP BY a.kind
  ) agg;

  RETURN jsonb_build_object('ok', true, 'chips', result);
END;
$$;

-- CONSENTED detail for the caller's own class. Only staff_visible rows;
-- every returned accommodation writes an audit row the student can read.
CREATE OR REPLACE FUNCTION public.flux_teacher_accommodation_details(p_class_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM teacher_classes tc
    WHERE tc.class_code = p_class_code AND tc.teacher_id = auth.uid() AND tc.active = true
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_your_class');
  END IF;

  WITH consented AS (
    SELECT a.id, a.student_id, a.kind, a.note,
           COALESCE(NULLIF(trim(ur.display_name), ''), 'Student') AS student_name
    FROM flux_student_accommodations a
    JOIN teacher_students ts
      ON ts.student_id = a.student_id
     AND ts.class_code = p_class_code
     AND ts.teacher_id = auth.uid()
     AND ts.active = true
    LEFT JOIN user_roles ur ON ur.user_id = a.student_id
    WHERE a.consent_state = 'staff_visible'
  ),
  audited AS (
    INSERT INTO flux_accommodation_audit (accommodation_id, student_id, viewer_id, action)
    SELECT id, student_id, auth.uid(), 'detail_view' FROM consented
    RETURNING accommodation_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'student', c.student_name, 'kind', c.kind, 'note', COALESCE(c.note, '')
  )), '[]'::jsonb)
  INTO result
  FROM consented c;

  RETURN jsonb_build_object('ok', true, 'details', result);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_teacher_accommodation_chips(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.flux_teacher_accommodation_details(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_teacher_accommodation_chips(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.flux_teacher_accommodation_details(text) TO authenticated;

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_accommodation_cards', 'Accommodation cards: counselor-managed, aggregate chips for teachers, consented detail with audit', false, 'counselor')
ON CONFLICT (key) DO NOTHING;
