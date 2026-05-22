-- Platform owner / platform_admins must not appear as bookable school counselors.

UPDATE public.counselors c
SET active = false,
    booking_enabled = false
WHERE lower(trim(coalesce(c.email, ''))) = 'azfermohammed21@gmail.com'
   OR lower(trim(coalesce(c.email, ''))) IN (
     SELECT lower(trim(pa.email))
     FROM public.platform_admins pa
   )
   OR c.user_id IN (
     SELECT u.id
     FROM auth.users u
     WHERE lower(trim(u.email)) = 'azfermohammed21@gmail.com'
   );

UPDATE public.user_roles ur
SET role = 'admin',
    updated_at = NOW()
FROM auth.users u
WHERE u.id = ur.user_id
  AND lower(trim(u.email)) = 'azfermohammed21@gmail.com'
  AND ur.role = 'counselor';
