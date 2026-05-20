-- P3-RECOVERY: assignment recovery plans with teacher approve workflow.

CREATE TABLE IF NOT EXISTS public.assignment_recovery_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.teacher_assignments(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'approved', 'rejected', 'completed')),
  plan_steps    JSONB NOT NULL DEFAULT '[]'::jsonb,
  reason        TEXT,
  teacher_note  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ,
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_recovery_teacher ON public.assignment_recovery_plans(teacher_id);
CREATE INDEX IF NOT EXISTS idx_recovery_student ON public.assignment_recovery_plans(student_id);
CREATE INDEX IF NOT EXISTS idx_recovery_status ON public.assignment_recovery_plans(status);

ALTER TABLE public.assignment_recovery_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arp_teacher_all" ON public.assignment_recovery_plans;
CREATE POLICY "arp_teacher_all" ON public.assignment_recovery_plans
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "arp_student_select" ON public.assignment_recovery_plans;
CREATE POLICY "arp_student_select" ON public.assignment_recovery_plans
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() AND status IN ('approved', 'completed'));

DROP POLICY IF EXISTS "arp_student_update" ON public.assignment_recovery_plans;
CREATE POLICY "arp_student_update" ON public.assignment_recovery_plans
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid() AND status = 'approved')
  WITH CHECK (student_id = auth.uid() AND status IN ('approved', 'completed'));

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_assignment_recovery', 'Assignment recovery plans — teacher propose/approve; students see approved steps', false, 'teacher')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
