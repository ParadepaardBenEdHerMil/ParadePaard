-- Adds date-effective versioning to project_function_billing_rates so historical
-- margin survives project rate changes, matching the client and employee billing
-- rate tables (V6). Existing rows are stamped active with effective_from =
-- created_at, then effective_from is made NOT NULL.
ALTER TABLE project_function_billing_rates ADD COLUMN IF NOT EXISTS effective_from TIMESTAMP;
ALTER TABLE project_function_billing_rates ADD COLUMN IF NOT EXISTS effective_to TIMESTAMP;
ALTER TABLE project_function_billing_rates ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE project_function_billing_rates SET effective_from = created_at WHERE effective_from IS NULL;

ALTER TABLE project_function_billing_rates ALTER COLUMN effective_from SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_project_function_billing_rate_active
    ON project_function_billing_rates (company_id, project_id, active);
