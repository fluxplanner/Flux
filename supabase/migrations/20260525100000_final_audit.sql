-- Phase 8: Final security audit — staff_tickets insert tightening, admin_duty_logs JWT binding.

-- ── 1. staff_tickets — drop loose / legacy policy names ─────────────────
DROP POLICY IF EXISTS "Enable read access for all users" ON public.staff_tickets;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.staff_tickets;
DROP POLICY IF EXISTS "staff_tickets_insert" ON public.staff_tickets;
DROP POLICY IF EXISTS "staff_tickets_insert_educator" ON public.staff_tickets;

CREATE POLICY "staff_tickets_insert_strict" ON public.staff_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('staff', 'teacher', 'counselor', 'admin')
        AND NULLIF(trim(ur.school), '') IS NOT NULL
    )
  );

-- ── 2. admin_duty_logs (cloud store for admin ops duty roster) ───────────
CREATE TABLE IF NOT EXISTS public.admin_duty_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school        TEXT NOT NULL,
  duty_label    TEXT NOT NULL,
  assignee_name TEXT,
  duty_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_duty_logs_admin ON public.admin_duty_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_duty_logs_school ON public.admin_duty_logs(school);
CREATE INDEX IF NOT EXISTS idx_admin_duty_logs_duty_date ON public.admin_duty_logs(duty_date DESC);

ALTER TABLE public.admin_duty_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_duty_logs_select_same_school" ON public.admin_duty_logs;
CREATE POLICY "admin_duty_logs_select_same_school" ON public.admin_duty_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles viewer
      WHERE viewer.user_id = auth.uid()
        AND viewer.role = 'admin'
        AND NULLIF(trim(viewer.school), '') IS NOT NULL
        AND lower(trim(viewer.school)) = lower(trim(admin_duty_logs.school))
    )
  );

DROP POLICY IF EXISTS "admin_duty_logs_insert" ON public.admin_duty_logs;
DROP POLICY IF EXISTS "admin_duty_logs_insert_strict" ON public.admin_duty_logs;
CREATE POLICY "admin_duty_logs_insert_strict" ON public.admin_duty_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    admin_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'admin'
        AND NULLIF(trim(ur.school), '') IS NOT NULL
        AND lower(trim(ur.school)) = lower(trim(admin_duty_logs.school))
    )
  );

DROP POLICY IF EXISTS "admin_duty_logs_update_own" ON public.admin_duty_logs;
CREATE POLICY "admin_duty_logs_update_own" ON public.admin_duty_logs
  FOR UPDATE TO authenticated
  USING (admin_id = auth.uid())
  WITH CHECK (admin_id = auth.uid());

DROP POLICY IF EXISTS "admin_duty_logs_delete_own" ON public.admin_duty_logs;
CREATE POLICY "admin_duty_logs_delete_own" ON public.admin_duty_logs
  FOR DELETE TO authenticated
  USING (admin_id = auth.uid());
