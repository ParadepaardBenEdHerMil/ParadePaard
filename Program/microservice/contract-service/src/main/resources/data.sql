-- keep seed scripts compatible with existing databases
CREATE TABLE IF NOT EXISTS functions (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    hourly_wage NUMERIC(19,2) NOT NULL
);

ALTER TABLE IF EXISTS functions ADD COLUMN IF NOT EXISTS id UUID;
ALTER TABLE IF EXISTS functions ADD COLUMN IF NOT EXISTS name VARCHAR(255);
ALTER TABLE IF EXISTS functions ADD COLUMN IF NOT EXISTS function_id UUID;
ALTER TABLE IF EXISTS functions ADD COLUMN IF NOT EXISTS function_name VARCHAR(255);
ALTER TABLE IF EXISTS functions ADD COLUMN IF NOT EXISTS department VARCHAR(255);
ALTER TABLE IF EXISTS functions ADD COLUMN IF NOT EXISTS hourly_wage NUMERIC(19,2);
ALTER TABLE IF EXISTS functions ADD COLUMN IF NOT EXISTS active BOOLEAN;

UPDATE functions
SET id = COALESCE(id, function_id, (md5(random()::text || clock_timestamp()::text))::uuid),
    name = COALESCE(name, function_name, 'Unknown'),
    function_id = COALESCE(function_id, id),
    function_name = COALESCE(NULLIF(function_name, 'Unknown'), name),
    hourly_wage = COALESCE(hourly_wage, 0),
    active = COALESCE(active, true)
WHERE id IS NULL
   OR name IS NULL
   OR function_id IS NULL
   OR function_name IS NULL
   OR function_name = 'Unknown'
   OR hourly_wage IS NULL
   OR active IS NULL;

UPDATE functions
SET function_id = id,
    function_name = name
WHERE function_id IS DISTINCT FROM id
   OR function_name IS DISTINCT FROM name;

UPDATE functions
SET active = false
WHERE hourly_wage = 0
  AND department IS NULL
  AND lower(name) IN ('developer', 'tester', 'designer');

ALTER TABLE IF EXISTS functions ALTER COLUMN id SET NOT NULL;
ALTER TABLE IF EXISTS functions ALTER COLUMN name SET NOT NULL;
ALTER TABLE IF EXISTS functions ALTER COLUMN hourly_wage SET NOT NULL;
ALTER TABLE IF EXISTS functions ALTER COLUMN active SET NOT NULL;

INSERT INTO functions (id, name, function_id, function_name, department, hourly_wage, active)
SELECT '11111111-0000-4000-8000-000000000001'::uuid, 'Bar',
       '11111111-0000-4000-8000-000000000001'::uuid, 'Bar',
       'Operations', 20.00, true
WHERE NOT EXISTS (SELECT 1 FROM functions WHERE lower(name) = 'bar');

INSERT INTO functions (id, name, function_id, function_name, department, hourly_wage, active)
SELECT '11111111-0000-4000-8000-000000000002'::uuid, 'Runner',
       '11111111-0000-4000-8000-000000000002'::uuid, 'Runner',
       'Operations', 18.75, true
WHERE NOT EXISTS (SELECT 1 FROM functions WHERE lower(name) = 'runner');

INSERT INTO functions (id, name, function_id, function_name, department, hourly_wage, active)
SELECT '11111111-0000-4000-8000-000000000003'::uuid, 'Supervisor',
       '11111111-0000-4000-8000-000000000003'::uuid, 'Supervisor',
       'Operations', 24.50, true
WHERE NOT EXISTS (SELECT 1 FROM functions WHERE lower(name) = 'supervisor');

ALTER TABLE IF EXISTS contracts DROP CONSTRAINT IF EXISTS contracts_user_id_key;
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS contract_type VARCHAR(40);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS status VARCHAR(20);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS function_id UUID;
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS function_name VARCHAR(255);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS gross_hourly_wage NUMERIC(19,2);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS travel_allowance BOOLEAN;
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS pdf_data BYTEA;
CREATE OR REPLACE PROCEDURE migrate_contract_pdf_data()
LANGUAGE plpgsql
AS 'BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = ''contracts''
          AND column_name = ''pdf_data''
          AND udt_name = ''oid''
    ) THEN
        ALTER TABLE contracts RENAME COLUMN pdf_data TO pdf_data_oid;
        ALTER TABLE contracts ADD COLUMN pdf_data BYTEA;
        ALTER TABLE contracts DROP COLUMN pdf_data_oid;
    END IF;
END';
CALL migrate_contract_pdf_data();
DROP PROCEDURE migrate_contract_pdf_data();
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS payout_schedule VARCHAR(40);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS wage_tax_amount_test NUMERIC(19,2) NOT NULL DEFAULT 0;
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS payment_frequency VARCHAR(80);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS weekly_hours NUMERIC(5,2);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS holiday_allowance_percentage NUMERIC(5,2);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS leave_entitlement_days INTEGER;
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS work_location VARCHAR(255);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS probation_period VARCHAR(255);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS notice_period VARCHAR(255);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS collective_agreement VARCHAR(255);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS pension_scheme VARCHAR(255);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS sickness_policy VARCHAR(1000);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS confidentiality_clause VARCHAR(1000);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS employer_signed_user_id UUID;
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS employer_typed_signature_name VARCHAR(255);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS employer_drawn_signature_image TEXT;
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS employer_agreement_checkbox_text VARCHAR(255);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS employer_contract_version VARCHAR(100);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS employer_document_hash VARCHAR(128);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS employer_ip_address VARCHAR(100);
ALTER TABLE IF EXISTS contracts ADD COLUMN IF NOT EXISTS employer_browser_user_agent VARCHAR(1000);
ALTER TABLE IF EXISTS contracts ALTER COLUMN wage_tax_amount_test SET DEFAULT 0;
ALTER TABLE IF EXISTS contracts ALTER COLUMN payout_schedule SET DEFAULT 'WEEKLY';
ALTER TABLE IF EXISTS contracts ALTER COLUMN end_date DROP NOT NULL;

UPDATE contracts SET contract_type = 'FIXED_HOURS' WHERE contract_type IS NULL;
UPDATE contracts SET status = 'DRAFT' WHERE status IS NULL;
UPDATE contracts SET wage_tax_amount_test = 0 WHERE wage_tax_amount_test IS NULL;
UPDATE contracts SET payout_schedule = 'WEEKLY' WHERE payout_schedule IS NULL;
UPDATE contracts SET payment_frequency = COALESCE(payment_frequency, payout_schedule, 'WEEKLY');
UPDATE contracts SET holiday_allowance_percentage = 8.00 WHERE holiday_allowance_percentage IS NULL;
UPDATE contracts SET leave_entitlement_days = 20 WHERE leave_entitlement_days IS NULL;
UPDATE contracts SET work_location = 'As agreed with the employer' WHERE work_location IS NULL;
UPDATE contracts SET notice_period = 'Statutory Dutch notice periods apply unless otherwise agreed in writing.' WHERE notice_period IS NULL;
UPDATE contracts SET sickness_policy = 'The employee must report sickness according to the employer absence policy and Dutch employment rules.' WHERE sickness_policy IS NULL;
UPDATE contracts SET function_name = CASE
    WHEN contract_type = 'ON_CALL_BAR' THEN 'Bar'
    WHEN contract_type = 'ON_CALL_RUNNER' THEN 'Runner'
    ELSE 'Employee'
END
WHERE function_name IS NULL;
UPDATE contracts c
SET function_id = f.id
FROM functions f
WHERE c.function_id IS NULL
  AND lower(c.function_name) = lower(f.name);
ALTER TABLE IF EXISTS contracts ALTER COLUMN function_name SET NOT NULL;
ALTER TABLE IF EXISTS contracts DROP CONSTRAINT IF EXISTS contracts_status_check;
ALTER TABLE IF EXISTS contracts ADD CONSTRAINT contracts_status_check CHECK (status IN (
    'DRAFT',
    'SENT_TO_EMPLOYEE',
    'EMPLOYEE_SIGNED',
    'FINALIZED',
    'REJECTED',
    'EXPIRED',
    'SIGNED'
));

