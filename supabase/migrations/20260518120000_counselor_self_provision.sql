-- Counselors: allow real accounts to register or claim a directory row.
-- Without this, user_roles.role = 'counselor' but counselors.user_id is NULL → empty dashboard.

CREATE UNIQUE INDEX IF NOT EXISTS counselors_user_id_key
  ON public.counselors (user_id)
  WHERE user_id IS NOT NULL;

DROP POLICY IF EXISTS "counselors_insert_own" ON public.counselors;
CREATE POLICY "counselors_insert_own" ON public.counselors
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "counselors_claim_email" ON public.counselors;
CREATE POLICY "counselors_claim_email" ON public.counselors
  FOR UPDATE TO authenticated
  USING (
    user_id IS NULL
    AND email IS NOT NULL
    AND length(trim(email)) > 0
    AND lower(trim(email)) = lower(trim(coalesce((auth.jwt() ->> 'email')::text, '')))
  )
  WITH CHECK (user_id = auth.uid());
