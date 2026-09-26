-- Read-only diagnosis. Run in Supabase SQL Editor as the project owner.
-- Counts distinguish absent rows from admin UI/RLS visibility issues.
SELECT
  count(*) AS google_auth_accounts,
  count(p.id) AS google_accounts_with_profiles,
  count(*) FILTER (WHERE p.id IS NULL) AS google_accounts_missing_profiles
FROM auth.users AS a
LEFT JOIN public.users AS p ON p.id = a.id
WHERE EXISTS (
  SELECT 1 FROM auth.identities AS i
  WHERE i.user_id = a.id AND i.provider = 'google'
);

SELECT t.tgname, t.tgenabled, pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger AS t
WHERE t.tgrelid = 'auth.users'::regclass AND NOT t.tgisinternal;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'users'
ORDER BY ordinal_position;

-- Resolve any returned legacy UUID/email conflicts before applying the repair.
SELECT a.id AS auth_id, p.id AS existing_profile_id
FROM auth.users AS a
JOIN public.users AS p ON lower(p.email) = lower(a.email) AND p.id <> a.id
WHERE NOT EXISTS (SELECT 1 FROM public.users AS own WHERE own.id = a.id);
