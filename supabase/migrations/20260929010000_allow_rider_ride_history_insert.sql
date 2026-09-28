-- Run AFTER 20260929000000_restore_rider_read_access.sql in Supabase SQL Editor.
-- Allows riders to append their own ride history. Does not change existing records.
BEGIN;

GRANT INSERT ON public.ride_history TO authenticated;

DROP POLICY IF EXISTS motolock_rider_insert_own_ride ON public.ride_history;
CREATE POLICY motolock_rider_insert_own_ride
ON public.ride_history
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = (SELECT public.motolock_reader_profile_id())
  AND (
    device_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.devices AS d
      WHERE d.id = ride_history.device_id
        AND d.user_id = (SELECT public.motolock_reader_profile_id())
    )
  )
);

COMMIT;

SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'ride_history'
ORDER BY policyname;
