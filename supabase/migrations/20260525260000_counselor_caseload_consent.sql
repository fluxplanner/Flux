-- P4-CASELOAD: counselor caseload health (consent-gated via student_counselors).

ALTER TABLE public.student_counselors
  ADD COLUMN IF NOT EXISTS insights_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_tier TEXT NOT NULL DEFAULT 'none'
    CHECK (consent_tier IN ('none', 'basic')),
  ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ;

COMMENT ON COLUMN public.student_counselors.insights_consent IS 'Student opted in to share basic engagement signals with assigned counselor';
COMMENT ON COLUMN public.student_counselors.consent_tier IS 'none = no insights; basic = name + engagement band only';

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_counselor_caseload', 'Counselor caseload health dashboard (consent-gated student insights)', false, 'counselor')
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  updated_at = NOW();
