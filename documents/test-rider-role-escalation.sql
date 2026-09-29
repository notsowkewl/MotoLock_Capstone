-- Regression test for 20260930030000_protect_user_roles.sql.
-- Run with psql against a disposable Supabase database using a real rider UUID:
--   psql "$DATABASE_URL" -v rider_id="<rider UUID>" -f documents/test-rider-role-escalation.sql
-- The UPDATEs must be rejected by the database trigger. This transaction rolls back.
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
    UPDATE public.users SET role = 'admin' WHERE id = auth.uid();
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE EXCEPTION 'Test requires an authenticated rider profile'; END IF;
    RAISE EXCEPTION 'FAIL: rider changed role';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: rider role update rejected by database';
  END;

  BEGIN
    UPDATE public.users SET status = 'inactive' WHERE id = auth.uid();
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE EXCEPTION 'Test requires an authenticated rider profile'; END IF;
    RAISE EXCEPTION 'FAIL: rider changed account status';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: rider status update rejected by database';
  END;
END;
$$;

ROLLBACK;
