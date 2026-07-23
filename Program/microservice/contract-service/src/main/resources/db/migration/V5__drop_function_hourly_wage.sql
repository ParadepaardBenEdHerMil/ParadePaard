-- V5: the job-function hourly_wage is no longer used. Wages now come solely from the contract
-- (gross_hourly_wage) / the statutory minimum wage schedule, so drop the unused column from the
-- functions master list. IF EXISTS keeps this a no-op on any DB where it was already removed.
ALTER TABLE public.functions DROP COLUMN IF EXISTS hourly_wage;
