-- P3-ASSIGN-INTEL: friction scores + scaffold decomposition on teacher_assignments.

ALTER TABLE public.teacher_assignments
  ADD COLUMN IF NOT EXISTS friction_score INTEGER,
  ADD COLUMN IF NOT EXISTS friction_tier TEXT
    CHECK (friction_tier IS NULL OR friction_tier IN ('none', 'warning', 'aged', 'severe')),
  ADD COLUMN IF NOT EXISTS scaffold_steps JSONB,
  ADD COLUMN IF NOT EXISTS intel_computed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.teacher_assignments.friction_score IS 'Predicted student friction 0–100 (assignment design)';
COMMENT ON COLUMN public.teacher_assignments.friction_tier IS 'Friction band for teacher UI';
COMMENT ON COLUMN public.teacher_assignments.scaffold_steps IS 'Suggested decomposition steps [{order,label,est_minutes}]';

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_teacher_assign_intel', 'Assignment intel — friction score + scaffold steps on post', false, 'teacher')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
