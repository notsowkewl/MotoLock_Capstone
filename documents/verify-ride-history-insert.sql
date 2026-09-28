-- Run AFTER 20260929010000_allow_rider_ride_history_insert.sql.
-- Tests the app's INSERT as the authenticated rider, then rolls it back.
-- Run the ENTIRE file together; no test ride is permanently saved.
BEGIN;
SELECT set_config('request.jwt.claims', json_build_object(
  'sub', (SELECT id FROM auth.users WHERE lower(btrim(email)) = 'jeoyooniee@gmail.com'),
  'role', 'authenticated'
)::text, true) IS NOT NULL AS test_identity_set;
SELECT set_config('request.jwt.claim.sub',
  (SELECT id::text FROM auth.users WHERE lower(btrim(email)) = 'jeoyooniee@gmail.com'), true
) IS NOT NULL AS test_subject_set;
SET LOCAL ROLE authenticated;

INSERT INTO public.ride_history
  (user_id, device_id, initial_brac_level, status, start_time)
VALUES (
  public.motolock_reader_profile_id(),
  (SELECT id FROM public.devices
   WHERE user_id = public.motolock_reader_profile_id() ORDER BY id LIMIT 1),
  0.0,
  'ongoing',
  now()
)
RETURNING true AS ride_insert_allowed;

ROLLBACK;
