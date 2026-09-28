-- Run this file in the linked MotoLock project's Supabase SQL Editor as postgres.
-- Restores SELECT access only. No records, IDs, credentials, or write policies change.
-- Existing policies are preserved; rerunning replaces only this repair's named policies.
BEGIN;

CREATE OR REPLACE FUNCTION public.motolock_reader_profile_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  caller_id uuid := auth.uid();
  caller_email text;
  profile_id uuid;
  matches bigint;
BEGIN
  IF caller_id IS NULL THEN RETURN NULL; END IF;

  -- Normal accounts: never substitute another profile when the auth UUID exists.
  SELECT p.id INTO profile_id FROM public.users p WHERE p.id = caller_id;
  IF FOUND THEN RETURN profile_id; END IF;

  -- Legacy profiles can be read only by a confirmed email owner. Do not use
  -- editable user metadata or claim a profile already owned by another auth account.
  SELECT lower(btrim(a.email)) INTO caller_email
  FROM auth.users a
  WHERE a.id = caller_id AND a.email_confirmed_at IS NOT NULL;
  IF caller_email IS NULL OR caller_email = '' THEN RETURN NULL; END IF;

  SELECT count(*), min(p.id::text)::uuid INTO matches, profile_id
  FROM public.users p WHERE lower(btrim(p.email)) = caller_email;
  IF matches <> 1 THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM auth.users a WHERE a.id = profile_id) THEN RETURN NULL; END IF;
  -- Also refuse ambiguous auth accounts sharing the same normalized email.
  IF EXISTS (
    SELECT 1 FROM auth.users a
    WHERE lower(btrim(a.email)) = caller_email AND a.id <> caller_id
  ) THEN RETURN NULL; END IF;
  RETURN profile_id;
END;
$$;

ALTER FUNCTION public.motolock_reader_profile_id() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.motolock_reader_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.motolock_reader_profile_id() TO authenticated;

DO $$
DECLARE
  target_table text;
  owner_column text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'users', 'motorcycles', 'emergency_contacts', 'pins', 'devices', 'ride_history'
  ] LOOP
    owner_column := CASE WHEN target_table = 'users' THEN 'id' ELSE 'user_id' END;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', target_table);
    EXECUTE format('DROP POLICY IF EXISTS motolock_rider_read_own ON public.%I', target_table);
    EXECUTE format(
      'CREATE POLICY motolock_rider_read_own ON public.%I FOR SELECT TO authenticated USING (%I = (SELECT public.motolock_reader_profile_id()))',
      target_table, owner_column
    );
  END LOOP;
END;
$$;

COMMIT;

-- Confirm all six read policies were installed. No rider data is printed.
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND policyname = 'motolock_rider_read_own'
ORDER BY tablename;
