-- ════════════════════════════════════════════════════════════════════
-- user_roles SELECT tightening (docs/RLS_AUDIT.md §1)
-- Replaces roles_select_educators (any auth user could read all educator rows).
-- Forward-only: DROP + CREATE scoped policies.
-- ════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "roles_select_educators" ON public.user_roles;

-- Educator directory within one school (both sides must have non-empty school).
CREATE POLICY "roles_select_educators_same_school" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    role IN ('teacher', 'counselor', 'staff', 'admin')
    AND EXISTS (
      SELECT 1 FROM public.user_roles viewer
      WHERE viewer.user_id = auth.uid()
        AND NULLIF(trim(viewer.school), '') IS NOT NULL
        AND NULLIF(trim(public.user_roles.school), '') IS NOT NULL
        AND lower(trim(viewer.school)) = lower(trim(public.user_roles.school))
    )
  );

-- Teachers read roster students' profile rows (joins / embeds on teacher_students).
CREATE POLICY "roles_select_students_i_teacher" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    role = 'student'
    AND EXISTS (
      SELECT 1 FROM public.teacher_students ts
      WHERE ts.teacher_id = auth.uid()
        AND ts.student_id = public.user_roles.user_id
        AND COALESCE(ts.active, true) = true
    )
  );

-- Counselors read students they counsel or have appointments with.
CREATE POLICY "roles_select_students_i_counselor" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    role = 'student'
    AND (
      EXISTS (
        SELECT 1 FROM public.student_counselors sc
        INNER JOIN public.counselors c ON c.id = sc.counselor_id
        WHERE c.user_id = auth.uid()
          AND sc.student_id = public.user_roles.user_id
      )
      OR EXISTS (
        SELECT 1 FROM public.counselor_appointments ca
        INNER JOIN public.counselors c ON c.id = ca.counselor_id
        WHERE c.user_id = auth.uid()
          AND ca.student_id = public.user_roles.user_id
      )
    )
  );

-- School admins: full user_roles listing (admin dashboard / user manager).
CREATE POLICY "roles_select_as_admin" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles me
      WHERE me.user_id = auth.uid()
        AND me.role = 'admin'
    )
  );
