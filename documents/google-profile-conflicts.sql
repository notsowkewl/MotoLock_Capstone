-- READ ONLY. Run in Supabase SQL Editor before changing profile IDs.
-- One JSON result keeps all diagnostics visible in the SQL Editor.
WITH conflicts AS (
  SELECT a.id AS auth_id, p.id AS profile_id,
         a.email_confirmed_at IS NOT NULL AS auth_email_confirmed,
         p.role AS profile_role, p.status AS profile_status,
         EXISTS (SELECT 1 FROM auth.identities i
                 WHERE i.user_id = a.id AND i.provider = 'google') AS uses_google,
         EXISTS (SELECT 1 FROM auth.users old_auth
                 WHERE old_auth.id = p.id) AS old_profile_has_auth_account
  FROM auth.users a
  JOIN public.users p ON lower(p.email) = lower(a.email) AND p.id <> a.id
  WHERE NOT EXISTS (SELECT 1 FROM public.users own WHERE own.id = a.id)
), foreign_keys AS (
  SELECT c.conrelid::regclass::text AS source_table,
         c.confrelid::regclass::text AS target_table,
         c.conname AS constraint_name,
         pg_get_constraintdef(c.oid) AS definition
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND (c.confrelid IN ('public.users'::regclass, 'auth.users'::regclass)
         OR c.conrelid = 'public.users'::regclass)
), profile_columns AS (
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'users'
), policies AS (
  SELECT schemaname, tablename, policyname, cmd, qual, with_check
  FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users'
), auth_triggers AS (
  SELECT t.tgname AS name, t.tgenabled AS enabled,
         pg_get_triggerdef(t.oid) AS definition
  FROM pg_trigger t
  WHERE t.tgrelid = 'auth.users'::regclass AND NOT t.tgisinternal
)
SELECT jsonb_build_object(
  'conflicts', (SELECT COALESCE(jsonb_agg(to_jsonb(c)), '[]'::jsonb) FROM conflicts c),
  'foreign_keys', (SELECT COALESCE(jsonb_agg(to_jsonb(f)), '[]'::jsonb) FROM foreign_keys f),
  'profile_columns', (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM profile_columns p),
  'profile_policies', (SELECT COALESCE(jsonb_agg(to_jsonb(p)), '[]'::jsonb) FROM policies p),
  'auth_triggers', (SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) FROM auth_triggers t)
) AS profile_diagnostics;
