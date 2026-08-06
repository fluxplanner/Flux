-- C2 — District Schedule Authority (flag enable_school_schedules).
--
-- Admins publish bell-schedule variants (assembly day, 2-hr delay, exam week)
-- and calendar exceptions (variant per date, or closure) school-wide; every
-- member's planner reflows automatically (FluxNow strip, rest-day engine).
--
-- School model: this codebase keys school membership on user_roles.school
-- (TEXT name; see 20260520120000_flux_schools_iae.sql + the same-school RLS
-- pattern in 20260521130000). The plan said school_id — adapted to the
-- house model rather than introducing a parallel keying scheme.
--
-- Rollback:
--   DROP TABLE IF EXISTS public.flux_school_calendar_days;
--   DROP TABLE IF EXISTS public.flux_school_bell_schedules;
--   DELETE FROM public.flux_feature_flags WHERE key = 'enable_school_schedules';

CREATE TABLE IF NOT EXISTS public.flux_school_bell_schedules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school     TEXT NOT NULL,
  label      TEXT NOT NULL,
  -- [{"label":"P1","start":"08:15","end":"09:05"}, …]
  periods    JSONB NOT NULL DEFAULT '[]',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bell_schedules_school
  ON public.flux_school_bell_schedules (lower(trim(school)));

CREATE TABLE IF NOT EXISTS public.flux_school_calendar_days (
  school      TEXT NOT NULL,
  date        DATE NOT NULL,
  schedule_id UUID REFERENCES public.flux_school_bell_schedules(id) ON DELETE SET NULL,
  closed      BOOLEAN NOT NULL DEFAULT false,
  note        TEXT,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (school, date)
);

ALTER TABLE public.flux_school_bell_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flux_school_calendar_days ENABLE ROW LEVEL SECURITY;

-- READ: any authenticated member of the same school (students join via
-- join_flux_school, which stamps user_roles.school).
DROP POLICY IF EXISTS "bell_schedules_select_members" ON public.flux_school_bell_schedules;
CREATE POLICY "bell_schedules_select_members" ON public.flux_school_bell_schedules
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles me
      WHERE me.user_id = auth.uid()
        AND NULLIF(trim(me.school), '') IS NOT NULL
        AND lower(trim(me.school)) = lower(trim(flux_school_bell_schedules.school))
    )
  );

DROP POLICY IF EXISTS "calendar_days_select_members" ON public.flux_school_calendar_days;
CREATE POLICY "calendar_days_select_members" ON public.flux_school_calendar_days
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles me
      WHERE me.user_id = auth.uid()
        AND NULLIF(trim(me.school), '') IS NOT NULL
        AND lower(trim(me.school)) = lower(trim(flux_school_calendar_days.school))
    )
  );

-- WRITE: admins of the same school only.
DROP POLICY IF EXISTS "bell_schedules_write_admin" ON public.flux_school_bell_schedules;
CREATE POLICY "bell_schedules_write_admin" ON public.flux_school_bell_schedules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles me
      WHERE me.user_id = auth.uid()
        AND me.role = 'admin'
        AND NULLIF(trim(me.school), '') IS NOT NULL
        AND lower(trim(me.school)) = lower(trim(flux_school_bell_schedules.school))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles me
      WHERE me.user_id = auth.uid()
        AND me.role = 'admin'
        AND NULLIF(trim(me.school), '') IS NOT NULL
        AND lower(trim(me.school)) = lower(trim(flux_school_bell_schedules.school))
    )
  );

DROP POLICY IF EXISTS "calendar_days_write_admin" ON public.flux_school_calendar_days;
CREATE POLICY "calendar_days_write_admin" ON public.flux_school_calendar_days
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles me
      WHERE me.user_id = auth.uid()
        AND me.role = 'admin'
        AND NULLIF(trim(me.school), '') IS NOT NULL
        AND lower(trim(me.school)) = lower(trim(flux_school_calendar_days.school))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles me
      WHERE me.user_id = auth.uid()
        AND me.role = 'admin'
        AND NULLIF(trim(me.school), '') IS NOT NULL
        AND lower(trim(me.school)) = lower(trim(flux_school_calendar_days.school))
    )
  );

-- Feature flag (client default false).
INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_school_schedules', 'District Schedule Authority: admin bell variants + calendar closures, planner reflows', false, 'platform')
ON CONFLICT (key) DO NOTHING;
