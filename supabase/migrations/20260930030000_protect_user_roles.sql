-- Role and account status are authorization data. Riders must never be able
-- to change either through PostgREST, regardless of UI or RLS policy changes.
BEGIN;

CREATE OR REPLACE FUNCTION public.prevent_user_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  request_role text := current_setting('request.jwt.claim.role', true);
BEGIN
  IF (NEW.role IS DISTINCT FROM OLD.role OR NEW.status IS DISTINCT FROM OLD.status)
     AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role')
     AND COALESCE(request_role, '') <> 'service_role' THEN
    RAISE EXCEPTION 'Only a trusted administrator service may change user role or status'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_user_privilege_escalation() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS prevent_user_privilege_escalation ON public.users;
CREATE TRIGGER prevent_user_privilege_escalation
  BEFORE UPDATE OF role, status ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_user_privilege_escalation();

COMMIT;

-- Regression check to run as authenticated: the statement must fail with 42501.
-- UPDATE public.users SET role = 'admin' WHERE id = auth.uid();
