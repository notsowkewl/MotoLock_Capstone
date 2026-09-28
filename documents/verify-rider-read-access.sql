-- Run AFTER 20260929000000_restore_rider_read_access.sql in Supabase SQL Editor.
-- Checks as the affected authenticated rider, NOT as the SQL Editor's admin role.
-- Read-only; exposes counts only. ROLLBACK restores the editor's role/session claims.
BEGIN READ ONLY;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', (SELECT id FROM auth.users WHERE lower(btrim(email)) = 'jeoyooniee@gmail.com'),
  'role', 'authenticated'
)::text, true) IS NOT NULL AS test_identity_set;
SELECT set_config('request.jwt.claim.sub',
  (SELECT id::text FROM auth.users WHERE lower(btrim(email)) = 'jeoyooniee@gmail.com'), true
) IS NOT NULL AS test_subject_set;
SET LOCAL ROLE authenticated;

SELECT
  (SELECT count(*) FROM public.users) AS visible_profiles,
  (SELECT count(*) FROM public.users WHERE face_descriptor IS NOT NULL) AS saved_face_profiles,
  (SELECT count(*) FROM public.motorcycles) AS motorcycles,
  (SELECT count(*) FROM public.emergency_contacts) AS contacts,
  (SELECT count(*) FROM public.pins) AS pins,
  (SELECT count(*) FROM public.devices) AS devices,
  (SELECT count(*) FROM public.users WHERE id IS DISTINCT FROM public.motolock_reader_profile_id()) AS other_profiles_visible,
  (SELECT count(*) FROM public.motorcycles WHERE user_id IS DISTINCT FROM public.motolock_reader_profile_id()) AS other_motorcycles_visible;
-- Expected for the supplied diagnostic: 1, 1, 1, 2, 1, 1, 0, 0.
ROLLBACK;
