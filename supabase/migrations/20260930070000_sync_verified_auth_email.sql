-- Keep the public rider email in sync with the verified Supabase Auth identity.
-- An email change never moves a profile between Auth UUIDs.
BEGIN;

CREATE OR REPLACE FUNCTION public.sync_verified_auth_email_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
    UPDATE public.users
    SET email = NEW.email, updated_at = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_verified_auth_email_to_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sync_verified_auth_email_to_profile ON auth.users;
CREATE TRIGGER sync_verified_auth_email_to_profile
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (NEW.email IS DISTINCT FROM OLD.email)
  EXECUTE FUNCTION public.sync_verified_auth_email_to_profile();

CREATE OR REPLACE FUNCTION public.prevent_unverified_profile_email_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  auth_email text;
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email
     AND auth.uid() = OLD.id THEN
    SELECT a.email INTO auth_email FROM auth.users a WHERE a.id = auth.uid();
    IF auth_email IS NULL OR NEW.email IS DISTINCT FROM auth_email THEN
      RAISE EXCEPTION 'Profile email must match the verified Supabase Auth identity'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.prevent_unverified_profile_email_change() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS prevent_unverified_profile_email_change ON public.users;
CREATE TRIGGER prevent_unverified_profile_email_change
  BEFORE UPDATE OF email ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.prevent_unverified_profile_email_change();

COMMIT;
