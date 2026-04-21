-- keep seed scripts compatible with existing databases
ALTER TABLE IF EXISTS payslips ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'RELEASED';
ALTER TABLE IF EXISTS payslips ADD COLUMN IF NOT EXISTS available_to_user_at DATE;
ALTER TABLE IF EXISTS payslips ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP;
ALTER TABLE IF EXISTS payslips ADD COLUMN IF NOT EXISTS error_description VARCHAR(2000);
ALTER TABLE IF EXISTS payslips ADD COLUMN IF NOT EXISTS total_employee_deductions NUMERIC(19,2);
ALTER TABLE IF EXISTS payslips ADD COLUMN IF NOT EXISTS deduction_lines_json TEXT;

UPDATE payslips SET status = 'RELEASED' WHERE status IS NULL;
UPDATE payslips SET available_to_user_at = date_of_issue WHERE available_to_user_at IS NULL;
UPDATE payslips SET generated_at = CURRENT_TIMESTAMP WHERE generated_at IS NULL;
UPDATE payslips
SET total_employee_deductions = wage_tax_withheld_test
WHERE total_employee_deductions IS NULL;

INSERT INTO payslips (
    payslip_id,
    user_id,
    date_of_issue,
    week_number,
    week_based_year,
    name,
    date_of_birth,
    start_date,
    function_name,
    hourly_wage,
    total_hours_worked,
    street_name,
    house_number,
    house_number_suffix,
    postal_code,
    city,
    country,
    total_gross_amount,
    wage_tax_withheld_test,
    travel_expenses,
    total_net_amount
)
SELECT
    'a3f1c2d4-1111-4e5f-8a2b-000000000001'::uuid,
    'b1e2f3a4-2222-4c5d-9b3c-000000000010'::uuid,
    '2025-07-01'::date,
    27,
    2025,
    'Alice Example',
    '1990-03-14'::date,
    '2022-01-15'::date,
    'On Call Bar',
    25.00,
    40.00,
    'Prinsengracht',
    '263',
    'A',
    '1016 GV',
    'Amsterdam',
    'NL',
    1000.00,
    200.00,
    45.00,
    845.00
    WHERE NOT EXISTS (
    SELECT 1 FROM payslips WHERE payslip_id = 'a3f1c2d4-1111-4e5f-8a2b-000000000001'::uuid
);

INSERT INTO payslips (
    payslip_id,
    user_id,
    date_of_issue,
    week_number,
    week_based_year,
    name,
    date_of_birth,
    start_date,
    function_name,
    hourly_wage,
    total_hours_worked,
    street_name,
    house_number,
    house_number_suffix,
    postal_code,
    city,
    country,
    total_gross_amount,
    wage_tax_withheld_test,
    travel_expenses,
    total_net_amount
)
SELECT
    'd4e5f6a7-3333-4b2c-7d1e-000000000002'::uuid,
    'c2f3e4b5-4444-4a1b-8c2d-000000000020'::uuid,
    '2025-07-08'::date,
    28,
    2025,
    'Bob Worker',
    '1985-07-22'::date,
    '2020-03-01'::date,
    'On Call Runner',
    21.00,
    50.00,
    'Oude Gracht',
    '120',
    NULL,
    '3511 EA',
    'Utrecht',
    'NL',
    1050.00,
    210.00,
    30.00,
    870.00
    WHERE NOT EXISTS (
    SELECT 1 FROM payslips WHERE payslip_id = 'd4e5f6a7-3333-4b2c-7d1e-000000000002'::uuid
);

INSERT INTO payslips (
    payslip_id,
    user_id,
    date_of_issue,
    week_number,
    week_based_year,
    name,
    date_of_birth,
    start_date,
    function_name,
    hourly_wage,
    total_hours_worked,
    street_name,
    house_number,
    house_number_suffix,
    postal_code,
    city,
    country,
    total_gross_amount,
    wage_tax_withheld_test,
    travel_expenses,
    total_net_amount
)
SELECT
    'f7a8b9c0-5555-4e5f-9e4f-000000000003'::uuid,
    'd3a4b5c6-6666-4d2e-1f3a-000000000030'::uuid,
    '2025-07-15'::date,
    29,
    2025,
    'Carol Remote',
    '1995-11-02'::date,
    '2023-06-20'::date,
    'Fixed Hours',
    25.00,
    40.00,
    'Marktstraat',
    '78',
    NULL,
    '3011 CB',
    'Rotterdam',
    'NL',
    1000.00,
    200.00,
    0.00,
    800.00
    WHERE NOT EXISTS (
    SELECT 1 FROM payslips WHERE payslip_id = 'f7a8b9c0-5555-4e5f-9e4f-000000000003'::uuid
);

INSERT INTO payslips (
    payslip_id,
    user_id,
    date_of_issue,
    week_number,
    week_based_year,
    name,
    date_of_birth,
    start_date,
    function_name,
    hourly_wage,
    total_hours_worked,
    street_name,
    house_number,
    house_number_suffix,
    postal_code,
    city,
    country,
    total_gross_amount,
    wage_tax_withheld_test,
    travel_expenses,
    total_net_amount
)
SELECT
    'b0c1d2e3-7777-4a5b-6c7d-000000000004'::uuid,
    'e4b5c6d7-8888-4c1f-2a3b-000000000040'::uuid,
    '2025-07-22'::date,
    30,
    2025,
    'Dave PartTime',
    '1978-02-28'::date,
    '2019-10-11'::date,
    'On Call Bar',
    15.00,
    10.00,
    'Heuvelstraat',
    '9',
    NULL,
    '5611 HP',
    'Eindhoven',
    'NL',
    150.00,
    30.00,
    10.00,
    130.00
    WHERE NOT EXISTS (
    SELECT 1 FROM payslips WHERE payslip_id = 'b0c1d2e3-7777-4a5b-6c7d-000000000004'::uuid
);

INSERT INTO payslips (
    payslip_id,
    user_id,
    date_of_issue,
    week_number,
    week_based_year,
    name,
    date_of_birth,
    start_date,
    function_name,
    hourly_wage,
    total_hours_worked,
    street_name,
    house_number,
    house_number_suffix,
    postal_code,
    city,
    country,
    total_gross_amount,
    wage_tax_withheld_test,
    travel_expenses,
    total_net_amount
)
SELECT
    'c5d6e7f8-9999-4d8a-0b1c-000000000005'::uuid,
    'f5c6d7e8-aaaa-4e9b-1c2d-000000000050'::uuid,
    '2025-07-29'::date,
    31,
    2025,
    'Eve Senior',
    '1982-10-05'::date,
    '2015-02-02'::date,
    'Fixed Hours',
    30.00,
    90.00,
    'Gardenlaan',
    '22',
    NULL,
    '2514 BE',
    'The Hague',
    'NL',
    2700.00,
    540.00,
    60.00,
    2220.00
    WHERE NOT EXISTS (
    SELECT 1 FROM payslips WHERE payslip_id = 'c5d6e7f8-9999-4d8a-0b1c-000000000005'::uuid
);

INSERT INTO payslips (
    payslip_id,
    user_id,
    date_of_issue,
    week_number,
    week_based_year,
    name,
    date_of_birth,
    start_date,
    function_name,
    hourly_wage,
    total_hours_worked,
    street_name,
    house_number,
    house_number_suffix,
    postal_code,
    city,
    country,
    total_gross_amount,
    wage_tax_withheld_test,
    travel_expenses,
    total_net_amount
)
SELECT
    '223e4567-e89b-12d3-a456-426614174201'::uuid,
    '223e4567-e89b-12d3-a456-426614174006'::uuid,
    '2026-01-04'::date,
    1,
    2026,
    'Test User',
    '1990-01-01'::date,
    '2025-01-01'::date,
    'On Call Bar',
    20.00,
    7.50,
    'Teststraat',
    '1',
    NULL,
    '1000 AA',
    'Amsterdam',
    'NL',
    150.00,
    0.00,
    1.50,
    151.50
    WHERE NOT EXISTS (
    SELECT 1 FROM payslips WHERE payslip_id = '223e4567-e89b-12d3-a456-426614174201'::uuid
);

INSERT INTO payslips (
    payslip_id,
    user_id,
    date_of_issue,
    week_number,
    week_based_year,
    name,
    date_of_birth,
    start_date,
    function_name,
    hourly_wage,
    total_hours_worked,
    street_name,
    house_number,
    house_number_suffix,
    postal_code,
    city,
    country,
    total_gross_amount,
    wage_tax_withheld_test,
    travel_expenses,
    total_net_amount
)
SELECT
    '5a1c4d0a-bf39-4a7e-ae0e-bc7402c1637a'::uuid,
    'b825a6bd-50d3-47e0-890d-78bfc59911b7'::uuid,
    '2026-01-11'::date,
    2,
    2026,
    'Joost van Stam',
    '1991-08-19'::date,
    '2025-02-01'::date,
    'On Call Runner',
    18.75,
    12.00,
    'Kerkstraat',
    '12',
    'B',
    '1017 GA',
    'Amsterdam',
    'NL',
    225.00,
    45.00,
    15.00,
    195.00
    WHERE NOT EXISTS (
    SELECT 1 FROM payslips WHERE payslip_id = '5a1c4d0a-bf39-4a7e-ae0e-bc7402c1637a'::uuid
);
