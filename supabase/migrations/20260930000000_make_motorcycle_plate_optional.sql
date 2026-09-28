-- A plate number is optional motorcycle information.
-- Preserve the existing unique constraint: PostgreSQL permits multiple NULLs
-- in a UNIQUE column while continuing to reject duplicate actual plate values.
ALTER TABLE public.motorcycles
  ALTER COLUMN plate_number DROP NOT NULL;
