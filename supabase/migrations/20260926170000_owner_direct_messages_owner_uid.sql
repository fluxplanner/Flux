-- Owner → one person messages: recognise the owner by account id, not email.
--
-- 20260904120000_owner_direct_messages.sql let the owner in by the email on
-- their sign-in token: azfermohammed21@gmail.com. Accounts have since moved to
-- username sign-in, and the owner's account email is now its username address,
-- so that check matched nobody. Every "Send to this person" was refused by RLS,
-- and the client, which assumed a refusal meant the table was missing, said
-- "has the owner_direct_messages migration been applied?" — it had been.
--
-- The account id never changes when the email does, so the owner rules now
-- use it, exactly as flux_password_help's owner policies already do. This
-- narrows nothing and widens nothing: the same one account, named by the
-- thing about it that cannot drift. The recipient policies are untouched.

DROP POLICY IF EXISTS "odm_owner_select" ON public.owner_direct_messages;
CREATE POLICY "odm_owner_select" ON public.owner_direct_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = 'eabe2b1f-e428-4181-8530-8e5366eb3975'::uuid);

DROP POLICY IF EXISTS "odm_owner_insert" ON public.owner_direct_messages;
CREATE POLICY "odm_owner_insert" ON public.owner_direct_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = 'eabe2b1f-e428-4181-8530-8e5366eb3975'::uuid);

DROP POLICY IF EXISTS "odm_owner_update" ON public.owner_direct_messages;
CREATE POLICY "odm_owner_update" ON public.owner_direct_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = 'eabe2b1f-e428-4181-8530-8e5366eb3975'::uuid)
  WITH CHECK (auth.uid() = 'eabe2b1f-e428-4181-8530-8e5366eb3975'::uuid);

DROP POLICY IF EXISTS "odm_owner_delete" ON public.owner_direct_messages;
CREATE POLICY "odm_owner_delete" ON public.owner_direct_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = 'eabe2b1f-e428-4181-8530-8e5366eb3975'::uuid);
