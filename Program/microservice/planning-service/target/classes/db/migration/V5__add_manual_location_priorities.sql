ALTER TABLE planning_client_location_usage
    ALTER COLUMN last_used_at DROP NOT NULL;

ALTER TABLE planning_client_location_usage
    ADD COLUMN IF NOT EXISTS manually_prioritized BOOLEAN NOT NULL DEFAULT FALSE;
