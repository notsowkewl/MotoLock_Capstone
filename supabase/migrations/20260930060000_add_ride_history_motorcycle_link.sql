-- Associate ride events with the selected motorcycle while preserving the rider-owned insert boundary.
BEGIN;

ALTER TABLE public.ride_history
  ADD COLUMN IF NOT EXISTS motorcycle_id uuid REFERENCES public.motorcycles(id) ON DELETE SET NULL;

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
  AND (
    motorcycle_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.motorcycles AS m
      WHERE m.id = ride_history.motorcycle_id
        AND m.user_id = (SELECT public.motolock_reader_profile_id())
    )
  )
);

COMMIT;
