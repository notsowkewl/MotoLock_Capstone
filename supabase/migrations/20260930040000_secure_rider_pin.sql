-- Store rider PINs as slow hashes and enforce per-account attempt throttling.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.user_security_pins (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_security_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_security_pins FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.user_security_pins TO service_role;

CREATE OR REPLACE FUNCTION public.has_rider_security_pin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND public.motolock_reader_profile_id() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_security_pins p
      WHERE p.user_id = public.motolock_reader_profile_id()
    );
$$;

CREATE OR REPLACE FUNCTION public.set_rider_security_pin(pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_id uuid := public.motolock_reader_profile_id();
BEGIN
  IF auth.uid() IS NULL OR profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in is required' USING ERRCODE = '28000';
  END IF;
  IF pin IS NULL OR pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'PIN must contain exactly four digits' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.user_security_pins(user_id, pin_hash, failed_attempts, locked_until, updated_at)
  VALUES (profile_id, extensions.crypt(pin, extensions.gen_salt('bf', 12)), 0, NULL, now())
  ON CONFLICT (user_id) DO NOTHING;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'A PIN is already configured; verify the current PIN before changing it'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_rider_security_pin(current_pin text, new_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_id uuid := public.motolock_reader_profile_id();
BEGIN
  IF auth.uid() IS NULL OR profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in is required' USING ERRCODE = '28000';
  END IF;
  IF current_pin IS NULL OR current_pin !~ '^[0-9]{4}$' OR new_pin IS NULL OR new_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Both PINs must contain exactly four digits' USING ERRCODE = '22023';
  END IF;
  IF NOT public.verify_rider_security_pin(current_pin) THEN
    RETURN false;
  END IF;
  UPDATE public.user_security_pins
  SET pin_hash = extensions.crypt(new_pin, extensions.gen_salt('bf', 12)),
      failed_attempts = 0, locked_until = NULL, updated_at = now()
  WHERE user_id = profile_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_rider_security_pin(pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  profile_id uuid := public.motolock_reader_profile_id();
  stored public.user_security_pins%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL OR profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in is required' USING ERRCODE = '28000';
  END IF;
  IF pin IS NULL OR pin !~ '^[0-9]{4}$' THEN RETURN false; END IF;

  SELECT * INTO stored FROM public.user_security_pins WHERE user_id = profile_id FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF stored.locked_until IS NOT NULL AND stored.locked_until > now() THEN
    RAISE EXCEPTION 'Too many incorrect PIN attempts. Try again after the cooldown.' USING ERRCODE = 'P0001';
  END IF;
  IF extensions.crypt(pin, stored.pin_hash) = stored.pin_hash THEN
    UPDATE public.user_security_pins SET failed_attempts = 0, locked_until = NULL, updated_at = now()
    WHERE user_id = profile_id;
    RETURN true;
  END IF;

  UPDATE public.user_security_pins
  SET failed_attempts = CASE WHEN failed_attempts >= 4 THEN 0 ELSE failed_attempts + 1 END,
      locked_until = CASE WHEN failed_attempts >= 4 THEN now() + interval '15 minutes' ELSE NULL END,
      updated_at = now()
  WHERE user_id = profile_id;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.set_rider_security_pin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_rider_security_pin(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.change_rider_security_pin(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_rider_security_pin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_rider_security_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_rider_security_pin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.change_rider_security_pin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_rider_security_pin() TO authenticated;

COMMIT;
