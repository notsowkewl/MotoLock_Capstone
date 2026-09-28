-- Read only. Run in the MotoLock project's Supabase SQL Editor.
-- Returns no passwords, PIN values, face data, tokens, or contact details.
WITH account_links AS (
  SELECT a.id AS auth_id, p.id AS profile_id,
         a.email_confirmed_at IS NOT NULL AS email_confirmed,
         EXISTS (SELECT 1 FROM auth.users old WHERE old.id = p.id) AS profile_has_auth_account
  FROM auth.users a
  LEFT JOIN public.users p ON lower(trim(p.email)) = lower(trim(a.email))
), affected_account AS (
  SELECT a.id = p.id AS ids_match, p.id IS NOT NULL AS profile_exists,
         p.face_descriptor IS NOT NULL AS face_saved,
         (SELECT count(*) FROM public.motorcycles m WHERE m.user_id = p.id) AS motorcycles,
         (SELECT count(*) FROM public.emergency_contacts c WHERE c.user_id = p.id) AS contacts,
         (SELECT count(*) FROM public.pins n WHERE n.user_id = p.id) AS pins,
         (SELECT count(*) FROM public.devices d WHERE d.user_id = p.id) AS devices
  FROM auth.users a
  LEFT JOIN public.users p ON lower(trim(p.email)) = lower(trim(a.email))
  WHERE lower(trim(a.email)) = 'jeoyooniee@gmail.com'
), policies AS (
  SELECT tablename, policyname, roles, cmd, qual, with_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('users', 'motorcycles', 'emergency_contacts', 'pins', 'devices', 'ride_history')
), foreign_keys AS (
  SELECT conrelid::regclass::text AS source_table, conname,
         pg_get_constraintdef(oid) AS definition
  FROM pg_constraint WHERE contype = 'f'
    AND confrelid IN ('public.users'::regclass, 'auth.users'::regclass)
)
SELECT jsonb_build_object(
  'affected_account', (SELECT jsonb_agg(to_jsonb(a)) FROM affected_account a),
  'all_accounts', (SELECT jsonb_build_object(
    'missing_profiles', count(*) FILTER (WHERE profile_id IS NULL),
    'mismatched_ids', count(*) FILTER (WHERE profile_id <> auth_id),
    'mismatches_with_existing_auth_owner', count(*) FILTER (WHERE profile_id <> auth_id AND profile_has_auth_account)
  ) FROM account_links),
  'policies', (SELECT jsonb_agg(to_jsonb(p)) FROM policies p),
  'foreign_keys', (SELECT jsonb_agg(to_jsonb(f)) FROM foreign_keys f)
) AS diagnosis;
