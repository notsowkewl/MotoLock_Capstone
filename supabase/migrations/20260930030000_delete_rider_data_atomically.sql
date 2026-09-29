-- Permanently remove a rider and the rows that belong to that rider.
-- Keep this operation in one database transaction so a failed foreign-key
-- check does not leave a partial deletion behind.
CREATE OR REPLACE FUNCTION public.admin_delete_rider_data(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.ride_history
  WHERE user_id = target_user_id
     OR device_id IN (
       SELECT d.id
       FROM public.devices AS d
       WHERE d.user_id = target_user_id
          OR d.motorcycle_id IN (
            SELECT m.id FROM public.motorcycles AS m WHERE m.user_id = target_user_id
          )
     );

  DELETE FROM public.devices
  WHERE user_id = target_user_id
     OR motorcycle_id IN (
       SELECT m.id FROM public.motorcycles AS m WHERE m.user_id = target_user_id
     );

  DELETE FROM public.motorcycles WHERE user_id = target_user_id;
  DELETE FROM public.emergency_contacts WHERE user_id = target_user_id;
  DELETE FROM public.pins WHERE user_id = target_user_id;
  DELETE FROM public.audit_logs WHERE user_id = target_user_id;
  DELETE FROM public.users WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_rider_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_rider_data(uuid) TO service_role;
