-- Let an authenticated rider manage only their own emergency contacts.
-- Use the profile-ID resolver so legacy profiles remain scoped to the
-- verified account that owns them, matching the rider read policy.
BEGIN;

DROP POLICY IF EXISTS motolock_rider_insert_own_emergency_contacts
  ON public.emergency_contacts;
CREATE POLICY motolock_rider_insert_own_emergency_contacts
  ON public.emergency_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT public.motolock_reader_profile_id())
  );

DROP POLICY IF EXISTS motolock_rider_update_own_emergency_contacts
  ON public.emergency_contacts;
CREATE POLICY motolock_rider_update_own_emergency_contacts
  ON public.emergency_contacts
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT public.motolock_reader_profile_id())
  )
  WITH CHECK (
    user_id = (SELECT public.motolock_reader_profile_id())
  );

DROP POLICY IF EXISTS motolock_rider_delete_own_emergency_contacts
  ON public.emergency_contacts;
CREATE POLICY motolock_rider_delete_own_emergency_contacts
  ON public.emergency_contacts
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT public.motolock_reader_profile_id())
  );

-- The older motorcycle policy checks auth.uid() directly. Replace it with
-- the same verified profile-ID resolver used by rider reads and contacts.
DROP POLICY IF EXISTS "Users manage own motorcycles"
  ON public.motorcycles;
DROP POLICY IF EXISTS motolock_rider_manage_own_motorcycles
  ON public.motorcycles;
CREATE POLICY motolock_rider_manage_own_motorcycles
  ON public.motorcycles
  FOR ALL TO authenticated
  USING (
    user_id = (SELECT public.motolock_reader_profile_id())
  )
  WITH CHECK (
    user_id = (SELECT public.motolock_reader_profile_id())
  );

COMMIT;
