-- Staff tickets: an edit must leave the ticket inside the editor's school.
--
-- staff_tickets_update_same_school let any teacher/counselor/staff/admin edit
-- a same-school ticket, but its WITH CHECK was `true`, so the edit itself was
-- unchecked: they could rewrite created_by to anyone (a user at another
-- school, a student), which moves the ticket out of their school and plants
-- it under someone else's name.
--
-- The fix reuses the USING test as the WITH CHECK, so the row must still
-- belong to a same-school creator after the edit. created_by itself is also
-- frozen: nobody but the service role may change who opened a ticket.
--
-- Rollback:
--   DROP TRIGGER IF EXISTS flux_staff_ticket_creator_frozen ON public.staff_tickets;
--   DROP FUNCTION IF EXISTS public.flux_staff_ticket_creator_frozen();
--   ALTER POLICY staff_tickets_update_same_school ON public.staff_tickets WITH CHECK (true);

ALTER POLICY staff_tickets_update_same_school ON public.staff_tickets
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles viewer
      WHERE viewer.user_id = auth.uid()
        AND viewer.role = ANY (ARRAY['teacher','counselor','staff','admin'])
        AND NULLIF(TRIM(BOTH FROM viewer.school), '') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.user_roles creator
          WHERE creator.user_id = staff_tickets.created_by
            AND NULLIF(TRIM(BOTH FROM creator.school), '') IS NOT NULL
            AND lower(TRIM(BOTH FROM creator.school)) = lower(TRIM(BOTH FROM viewer.school))
        )
    )
  );

CREATE OR REPLACE FUNCTION public.flux_staff_ticket_creator_frozen()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'created_by cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.flux_staff_ticket_creator_frozen() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS flux_staff_ticket_creator_frozen ON public.staff_tickets;
CREATE TRIGGER flux_staff_ticket_creator_frozen
  BEFORE UPDATE OF created_by ON public.staff_tickets
  FOR EACH ROW EXECUTE FUNCTION public.flux_staff_ticket_creator_frozen();
