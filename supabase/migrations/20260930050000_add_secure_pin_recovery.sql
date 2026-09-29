-- Service-only PIN recovery entry points and email-scoped rate limits.
BEGIN;

CREATE TABLE IF NOT EXISTS public.rider_pin_recovery_limits (
  email_hash text PRIMARY KEY CHECK (email_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  verify_count integer NOT NULL DEFAULT 0 CHECK (verify_count >= 0)
);
ALTER TABLE public.rider_pin_recovery_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rider_pin_recovery_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rider_pin_recovery_limits TO service_role;

CREATE OR REPLACE FUNCTION public.allow_rider_pin_recovery_attempt(email_hash text, attempt_kind text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  limits public.rider_pin_recovery_limits%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authorization required' USING ERRCODE = '42501';
  END IF;
  IF email_hash IS NULL OR email_hash !~ '^[0-9a-f]{64}$'
     OR attempt_kind IS NULL OR attempt_kind NOT IN ('request', 'complete') THEN
    RAISE EXCEPTION 'Invalid recovery limit request' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.rider_pin_recovery_limits(email_hash) VALUES (allow_rider_pin_recovery_attempt.email_hash)
  ON CONFLICT (email_hash) DO NOTHING;
  SELECT * INTO limits FROM public.rider_pin_recovery_limits r
  WHERE r.email_hash = allow_rider_pin_recovery_attempt.email_hash FOR UPDATE;

  IF limits.window_started_at < now() - interval '15 minutes' THEN
    UPDATE public.rider_pin_recovery_limits
    SET window_started_at = now(), request_count = 0, verify_count = 0
    WHERE rider_pin_recovery_limits.email_hash = allow_rider_pin_recovery_attempt.email_hash
    RETURNING * INTO limits;
  END IF;

  IF attempt_kind = 'request' THEN
    UPDATE public.rider_pin_recovery_limits SET request_count = request_count + 1
    WHERE rider_pin_recovery_limits.email_hash = allow_rider_pin_recovery_attempt.email_hash
    RETURNING * INTO limits;
    RETURN limits.request_count <= 3;
  END IF;

  UPDATE public.rider_pin_recovery_limits SET verify_count = verify_count + 1
  WHERE rider_pin_recovery_limits.email_hash = allow_rider_pin_recovery_attempt.email_hash
  RETURNING * INTO limits;
  RETURN limits.verify_count <= 8;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_rider_security_pin(target_user_id uuid, new_pin text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service authorization required' USING ERRCODE = '42501';
  END IF;
  IF target_user_id IS NULL OR new_pin IS NULL OR new_pin !~ '^[0-9]{4}$'
     OR new_pin IN ('0000', '1111', '2222', '3333', '4444', '5555', '6666', '7777', '8888', '9999', '1234', '4321') THEN
    RAISE EXCEPTION 'A valid nontrivial four-digit PIN is required' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.user_security_pins(user_id, pin_hash, failed_attempts, locked_until, updated_at)
  VALUES (target_user_id, extensions.crypt(new_pin, extensions.gen_salt('bf', 12)), 0, NULL, now())
  ON CONFLICT (user_id) DO UPDATE SET
    pin_hash = EXCLUDED.pin_hash,
    failed_attempts = 0,
    locked_until = NULL,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.allow_rider_pin_recovery_attempt(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_reset_rider_security_pin(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.allow_rider_pin_recovery_attempt(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_reset_rider_security_pin(uuid, text) TO service_role;

COMMIT;
