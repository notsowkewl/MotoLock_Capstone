-- Store exceptional ride events without extending the existing status enum.
-- Existing ride statuses remain unchanged; ordinary rows leave event_type NULL.
ALTER TABLE public.ride_history
  ADD COLUMN IF NOT EXISTS event_type text;

ALTER TABLE public.ride_history
  DROP CONSTRAINT IF EXISTS ride_history_event_type_check;

ALTER TABLE public.ride_history
  ADD CONSTRAINT ride_history_event_type_check
  CHECK (event_type IS NULL OR event_type IN ('manual_override'));
