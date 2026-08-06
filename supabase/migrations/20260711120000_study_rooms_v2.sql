-- C8 — Study Rooms v2 (flag enable_study_rooms_v2).
--
-- Co-work rooms (P-cowork) are ephemeral Supabase channels — no content is
-- ever stored. v2 adds a minimal REGISTRY so teachers get "study hall
-- mode": the room list + participant counts for their own classes, and
-- nothing else (no codes, no checklist content, no messages — the content
-- never touches the server in the first place).
--
-- Rollback:
--   DROP FUNCTION IF EXISTS public.flux_teacher_study_hall(text);
--   DROP TABLE IF EXISTS public.flux_study_rooms;
--   DELETE FROM public.flux_feature_flags WHERE key = 'enable_study_rooms_v2';

CREATE TABLE IF NOT EXISTS public.flux_study_rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         TEXT UNIQUE NOT NULL,
  class_code   TEXT,
  label        TEXT NOT NULL,
  host_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  school       TEXT,
  participants INTEGER NOT NULL DEFAULT 1,
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_study_rooms_class
  ON public.flux_study_rooms(class_code) WHERE active = true;

ALTER TABLE public.flux_study_rooms ENABLE ROW LEVEL SECURITY;

-- Host manages their own registry rows; no general SELECT — teachers go
-- through the aggregate RPC below.
DROP POLICY IF EXISTS "study_rooms_host_all" ON public.flux_study_rooms;
CREATE POLICY "study_rooms_host_all" ON public.flux_study_rooms
  FOR ALL TO authenticated
  USING (host_id = auth.uid())
  WITH CHECK (host_id = auth.uid());

-- Study hall mode: label + participant count + age for the caller's OWN
-- active class. Room codes are deliberately not returned (teachers monitor,
-- they don't join student rooms); stale rows (>10 min without heartbeat)
-- are filtered out.
CREATE OR REPLACE FUNCTION public.flux_teacher_study_hall(p_class_code TEXT)
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

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'label', label,
    'participants', participants,
    'started_at', created_at
  ) ORDER BY created_at DESC), '[]'::jsonb)
  INTO result
  FROM flux_study_rooms
  WHERE class_code = p_class_code
    AND active = true
    AND last_seen_at > NOW() - INTERVAL '10 minutes';

  RETURN jsonb_build_object('ok', true, 'rooms', result);
END;
$$;

REVOKE ALL ON FUNCTION public.flux_teacher_study_hall(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_teacher_study_hall(text) TO authenticated;

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  ('enable_study_rooms_v2', 'Study Rooms v2: class templates, teacher study-hall counts, group focus cosmetics, name guardrail', false, 'student')
ON CONFLICT (key) DO NOTHING;
