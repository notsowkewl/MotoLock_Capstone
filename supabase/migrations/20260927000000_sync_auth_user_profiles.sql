-- Run in the linked project's Supabase SQL Editor.
-- Keeps existing profiles, roles, status, and verification data unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.users
    (id, email, name, password_hash, role, status, created_at, updated_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'full_name'), ''),
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'name'), ''),
      NULLIF(btrim(NEW.raw_user_meta_data ->> 'fullName'), ''),
      NULLIF(split_part(NEW.email, '@', 1), ''),
      'Rider'
    ),
    'supabase-auth-managed',
    'rider',
    'active',
    COALESCE(NEW.created_at, now()),
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Repair only Google accounts that signed in before the trigger existed.
-- Leave legacy email/password accounts and privileged profiles unchanged.
-- Do not copy password hashes or trust
-- user-editable metadata to grant roles or verification status.
INSERT INTO public.users
  (id, email, name, password_hash, role, status, created_at, updated_at)
SELECT
  a.id,
  a.email,
  COALESCE(
    NULLIF(btrim(a.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(btrim(a.raw_user_meta_data ->> 'name'), ''),
    NULLIF(btrim(a.raw_user_meta_data ->> 'fullName'), ''),
    NULLIF(split_part(a.email, '@', 1), ''),
    'Rider'
  ),
  'supabase-auth-managed', 'rider', 'active',
  COALESCE(a.created_at, now()), now()
FROM auth.users AS a
WHERE a.email IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM auth.identities AS i
    WHERE i.user_id = a.id AND i.provider = 'google'
  )
  AND NOT EXISTS (SELECT 1 FROM public.users AS p WHERE p.id = a.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.users AS p WHERE lower(p.email) = lower(a.email)
  )
ON CONFLICT (id) DO NOTHING;

-- An email belonging to a different profile UUID will cause a unique-constraint
-- failure and roll back this transaction; never silently reassign that profile.
COMMIT;

-- Expected result: 0. Nonzero means a Google profile still needs investigation.
SELECT count(*) AS google_accounts_without_profiles
FROM auth.users AS a
LEFT JOIN public.users AS p ON p.id = a.id
WHERE a.email IS NOT NULL AND p.id IS NULL
  AND EXISTS (
    SELECT 1 FROM auth.identities AS i
    WHERE i.user_id = a.id AND i.provider = 'google'
  );
