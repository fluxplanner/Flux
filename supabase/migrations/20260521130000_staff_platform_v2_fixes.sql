-- Staff platform v2: dynamic platform admins, applicant_note rename, staff_tickets cloud store.
-- Idempotent: safe to re-run.

-- ── 1. Platform admins (replaces hardcoded owner email in RLS) ─────
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

INSERT INTO public.platform_admins (email)
SELECT 'azfermohammed21@gmail.com'
WHERE NOT EXISTS (
  SELECT 1 FROM public.platform_admins pa
  WHERE lower(trim(pa.email)) = 'azfermohammed21@gmail.com'
);

CREATE OR REPLACE FUNCTION public.flux_is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins pa
    WHERE lower(trim(pa.email)) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
  );
$$;

REVOKE ALL ON FUNCTION public.flux_is_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.flux_is_platform_admin() TO authenticated;

-- ── 2. Rename staff_verification_requests.student_note → applicant_note ──
DO $$ BEGIN
  ALTER TABLE public.staff_verification_requests
    RENAME COLUMN student_note TO applicant_note;
EXCEPTION
  WHEN undefined_column THEN
    ALTER TABLE public.staff_verification_requests
      ADD COLUMN IF NOT EXISTS applicant_note TEXT;
  WHEN duplicate_column THEN NULL;
END $$;

-- ── 3. staff_tickets (replaces flux_staff_tickets_v1 localStorage) ──
CREATE TABLE IF NOT EXISTS public.staff_tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  department  TEXT,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_tickets_created_by ON public.staff_tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_staff_tickets_status ON public.staff_tickets(status);
CREATE INDEX IF NOT EXISTS idx_staff_tickets_created_at ON public.staff_tickets(created_at DESC);

ALTER TABLE public.staff_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_tickets_select_same_school" ON public.staff_tickets;
CREATE POLICY "staff_tickets_select_same_school" ON public.staff_tickets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles viewer
      WHERE viewer.user_id = auth.uid()
        AND viewer.role IN ('teacher', 'counselor', 'staff', 'admin')
        AND NULLIF(trim(viewer.school), '') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.user_roles creator
          WHERE creator.user_id = staff_tickets.created_by
            AND NULLIF(trim(creator.school), '') IS NOT NULL
            AND lower(trim(creator.school)) = lower(trim(viewer.school))
        )
    )
  );

DROP POLICY IF EXISTS "staff_tickets_insert_educator" ON public.staff_tickets;
CREATE POLICY "staff_tickets_insert_educator" ON public.staff_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('teacher', 'counselor', 'staff', 'admin')
    )
  );

DROP POLICY IF EXISTS "staff_tickets_update_same_school" ON public.staff_tickets;
CREATE POLICY "staff_tickets_update_same_school" ON public.staff_tickets
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles viewer
      WHERE viewer.user_id = auth.uid()
        AND viewer.role IN ('teacher', 'counselor', 'staff', 'admin')
        AND NULLIF(trim(viewer.school), '') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.user_roles creator
          WHERE creator.user_id = staff_tickets.created_by
            AND NULLIF(trim(creator.school), '') IS NOT NULL
            AND lower(trim(creator.school)) = lower(trim(viewer.school))
        )
    )
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "staff_tickets_delete_creator" ON public.staff_tickets;
CREATE POLICY "staff_tickets_delete_creator" ON public.staff_tickets
  FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- ── 4. Replace hardcoded owner email policies ─────────────────────
DROP POLICY IF EXISTS "roles_platform_owner_update" ON public.user_roles;
CREATE POLICY "roles_platform_owner_update" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.flux_is_platform_admin())
  WITH CHECK (true);

DROP POLICY IF EXISTS "svr_owner_select" ON public.staff_verification_requests;
CREATE POLICY "svr_owner_select" ON public.staff_verification_requests
  FOR SELECT TO authenticated
  USING (public.flux_is_platform_admin());

DROP POLICY IF EXISTS "svr_owner_update" ON public.staff_verification_requests;
CREATE POLICY "svr_owner_update" ON public.staff_verification_requests
  FOR UPDATE TO authenticated
  USING (public.flux_is_platform_admin())
  WITH CHECK (true);

DROP POLICY IF EXISTS "feed_owner_delete" ON public.school_feed;
CREATE POLICY "feed_owner_delete" ON public.school_feed
  FOR DELETE TO authenticated
  USING (public.flux_is_platform_admin());
