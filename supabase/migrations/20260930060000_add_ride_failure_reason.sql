-- Store the actual reason a ride or safety verification failed.
ALTER TABLE public.ride_history
  ADD COLUMN IF NOT EXISTS failure_reason text;
