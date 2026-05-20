-- Counselor booking: students see slot occupancy; inserts require assigned counselor.

DROP POLICY IF EXISTS "appts_student_counselor_slots" ON public.counselor_appointments;
CREATE POLICY "appts_student_counselor_slots" ON public.counselor_appointments
  FOR SELECT TO authenticated
  USING (
    status IS DISTINCT FROM 'cancelled'
    AND counselor_id IN (
      SELECT sc.counselor_id
      FROM public.student_counselors sc
      WHERE sc.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "appts_student_insert" ON public.counselor_appointments;
CREATE POLICY "appts_student_insert" ON public.counselor_appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND counselor_id IN (
      SELECT sc.counselor_id
      FROM public.student_counselors sc
      WHERE sc.student_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.counselors c
      WHERE c.id = counselor_id
        AND c.active = true
        AND c.booking_enabled = true
    )
  );
