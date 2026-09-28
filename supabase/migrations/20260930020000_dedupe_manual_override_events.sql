-- Add an idempotency key so multiple Bluetooth readers/retries cannot create
-- duplicate history rows for the same physical manual-override episode.
ALTER TABLE public.ride_history
  ADD COLUMN IF NOT EXISTS event_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS ride_history_manual_override_event_id_uidx
  ON public.ride_history (event_id)
  WHERE event_type = 'manual_override' AND event_id IS NOT NULL;
