-- Run against a disposable Supabase database with a verified rider UUID that has no PIN.
-- Each assertion runs as authenticated; the transaction rolls back all test data.
\set ON_ERROR_STOP on
BEGIN;
SELECT set_config('request.jwt.claim.sub', :'rider_id', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  IF public.has_rider_security_pin() THEN
    RAISE EXCEPTION 'Test requires a rider with no existing PIN';
  END IF;
  PERFORM public.set_rider_security_pin('7482');
  IF NOT public.has_rider_security_pin() THEN
    RAISE EXCEPTION 'FAIL: the rider PIN was not created';
  END IF;
  IF NOT public.verify_rider_security_pin('7482') THEN
    RAISE EXCEPTION 'FAIL: the newly created PIN could not be verified';
  END IF;
  IF NOT public.change_rider_security_pin('7482', '6829') THEN
    RAISE EXCEPTION 'FAIL: the rider could not update their own PIN';
  END IF;
  IF NOT public.verify_rider_security_pin('6829') THEN
    RAISE EXCEPTION 'FAIL: the updated PIN could not be verified';
  END IF;
  BEGIN
    UPDATE public.user_security_pins SET pin_hash = 'forged' WHERE user_id = auth.uid();
    RAISE EXCEPTION 'FAIL: direct PIN table update was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: direct PIN table write denied; own create/update RPCs work';
  END;
END;
$$;

ROLLBACK;
