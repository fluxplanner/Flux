-- P5-EMERGENCY: school-wide emergency / calm mode broadcast (singleton state).

CREATE TABLE IF NOT EXISTS public.flux_school_broadcast (
  school_slug TEXT PRIMARY KEY DEFAULT 'default',
  mode        TEXT NOT NULL DEFAULT 'normal'
    CHECK (mode IN ('normal', 'calm', 'emergency')),
  message     TEXT,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.flux_school_broadcast (school_slug, mode)
VALUES ('default', 'normal')
ON CONFLICT (school_slug) DO NOTHING;

ALTER TABLE public.flux_school_broadcast ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fsb_read_all" ON public.flux_school_broadcast;
CREATE POLICY "fsb_read_all" ON public.flux_school_broadcast
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "fsb_admin_write" ON public.flux_school_broadcast;
CREATE POLICY "fsb_admin_write" ON public.flux_school_broadcast
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'staff')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role IN ('admin', 'staff')
    )
  );

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_school_emergency_broadcast', 'School emergency + calm mode broadcast (live UI state for all signed-in users)', false, 'admin')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
