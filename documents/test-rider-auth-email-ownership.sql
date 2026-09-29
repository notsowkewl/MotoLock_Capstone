-- Run after 20260930070000_sync_verified_auth_email.sql against a disposable Supabase database.
-- The authenticated rider's public profile email must remain bound to auth.users.email.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', :'rider_id', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
DECLARE
  changed integer;
BEGIN
  BEGIN
    UPDATE public.users SET email = 'unverified-change@example.invalid' WHERE id = auth.uid();
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE EXCEPTION 'Test requires an authenticated rider profile'; END IF;
    RAISE EXCEPTION 'FAIL: rider changed profile email without verifying it through Auth';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: unverified direct profile email change rejected';
  END;
END;
$$;

ROLLBACK;
