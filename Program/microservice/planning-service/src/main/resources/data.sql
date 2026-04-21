ALTER TABLE IF EXISTS public.schedule_entries
    ADD COLUMN IF NOT EXISTS timesheet_exported BOOLEAN;

UPDATE public.schedule_entries
SET timesheet_exported = FALSE
WHERE timesheet_exported IS NULL;

ALTER TABLE IF EXISTS public.schedule_entries
    ALTER COLUMN timesheet_exported SET DEFAULT FALSE;

ALTER TABLE IF EXISTS public.schedule_entries
    ALTER COLUMN timesheet_exported SET NOT NULL;

ALTER TABLE IF EXISTS public.events
    ADD COLUMN IF NOT EXISTS event_timezone VARCHAR(100);

UPDATE public.events
SET event_timezone = 'UTC'
WHERE event_timezone IS NULL OR trim(event_timezone) = '';

ALTER TABLE IF EXISTS public.events
    ALTER COLUMN event_timezone SET DEFAULT 'UTC';

ALTER TABLE IF EXISTS public.events
    ALTER COLUMN event_timezone SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_event_company_date_range
    ON public.events (company_id, start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_shift_event_start_end
    ON public.shifts (event_id, start_time, end_time);

CREATE INDEX IF NOT EXISTS idx_schedule_shift_status
    ON public.schedule_entries (shift_id, status);
