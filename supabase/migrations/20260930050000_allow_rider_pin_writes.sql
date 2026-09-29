-- Allow authenticated riders to create or change only their own security PIN.
-- Reuse the verified profile-ID resolver used by the rider's read policies.
BEGIN;

DROP POLICY IF EXISTS motolock_rider_insert_own_pin
  ON public.pins;
CREATE POLICY motolock_rider_insert_own_pin
  ON public.pins
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT public.motolock_reader_profile_id())
  );

DROP POLICY IF EXISTS motolock_rider_update_own_pin
  ON public.pins;
CREATE POLICY motolock_rider_update_own_pin
  ON public.pins
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT public.motolock_reader_profile_id())
  )
  WITH CHECK (
    user_id = (SELECT public.motolock_reader_profile_id())
  );

COMMIT;
