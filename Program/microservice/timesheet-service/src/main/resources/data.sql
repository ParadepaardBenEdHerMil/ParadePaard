/* ---------- TABLE ---------- */
CREATE TABLE IF NOT EXISTS timesheets
(
    timesheet_id      UUID PRIMARY KEY,
    user_id           UUID NOT NULL,
    date_of_issue     DATE NOT NULL,
    week_number       INTEGER,
    week_based_year   INTEGER,
    name              VARCHAR(255),
    function          VARCHAR(255),
    hours_worked      NUMERIC(19,2),
    travel_expenses   NUMERIC(19,2)
    );

/* ---------- SAMPLE ROWS ---------- */

/* Alice Developer: issued 2025 07 01 (ISO week 27) */
INSERT INTO timesheets (
    timesheet_id,
    user_id,
    date_of_issue,
    week_number,
    week_based_year,
    name,
    function,
    hours_worked,
    travel_expenses
)
SELECT
    'a3f1c2d4-1111-4e5f-8a2b-000000000011'::uuid,
    'b1e2f3a4-2222-4c5d-9b3c-000000000010'::uuid,
    '2025-07-01'::date,
    27,
    2025,
    'Alice Example',
    'Developer',
    40.00,
    12.50
    WHERE NOT EXISTS (
    SELECT 1
    FROM timesheets
    WHERE timesheet_id = 'a3f1c2d4-1111-4e5f-8a2b-000000000011'::uuid
);

/* Bob Tester: issued 2025 07 08 (ISO week 28) */
INSERT INTO timesheets (
    timesheet_id,
    user_id,
    date_of_issue,
    week_number,
    week_based_year,
    name,
    function,
    hours_worked,
    travel_expenses
)
SELECT
    'd4e5f6a7-3333-4b2c-7d1e-000000000012'::uuid,
    'c2f3e4b5-4444-4a1b-8c2d-000000000020'::uuid,
    '2025-07-08'::date,
    28,
    2025,
    'Bob Worker',
    'Tester',
    35.00,
    0.00
    WHERE NOT EXISTS (
    SELECT 1
    FROM timesheets
    WHERE timesheet_id = 'd4e5f6a7-3333-4b2c-7d1e-000000000012'::uuid
);

/* Carol Designer: issued 2025 07 15 (ISO week 29) */
INSERT INTO timesheets (
    timesheet_id,
    user_id,
    date_of_issue,
    week_number,
    week_based_year,
    name,
    function,
    hours_worked,
    travel_expenses
)
SELECT
    'f7a8b9c0-5555-4e5f-9e4f-000000000013'::uuid,
    'd3a4b5c6-6666-4d2e-1f3a-000000000030'::uuid,
    '2025-07-15'::date,
    29,
    2025,
    'Carol Remote',
    'Designer',
    20.00,
    7.80
    WHERE NOT EXISTS (
    SELECT 1
    FROM timesheets
    WHERE timesheet_id = 'f7a8b9c0-5555-4e5f-9e4f-000000000013'::uuid
);

/* Dave Support: issued 2025 07 22 (ISO week 30) */
INSERT INTO timesheets (
    timesheet_id,
    user_id,
    date_of_issue,
    week_number,
    week_based_year,
    name,
    function,
    hours_worked,
    travel_expenses
)
SELECT
    'b0c1d2e3-7777-4a5b-6c7d-000000000014'::uuid,
    'e4b5c6d7-8888-4c1f-2a3b-000000000040'::uuid,
    '2025-07-22'::date,
    30,
    2025,
    'Dave PartTime',
    'Support',
    10.00,
    3.20
    WHERE NOT EXISTS (
    SELECT 1
    FROM timesheets
    WHERE timesheet_id = 'b0c1d2e3-7777-4a5b-6c7d-000000000014'::uuid
);

/* Eve Manager: issued 2025 07 29 (ISO week 31) */
INSERT INTO timesheets (
    timesheet_id,
    user_id,
    date_of_issue,
    week_number,
    week_based_year,
    name,
    function,
    hours_worked,
    travel_expenses
)
SELECT
    'c5d6e7f8-9999-4d8a-0b1c-000000000015'::uuid,
    'f5c6d7e8-aaaa-4e9b-1c2d-000000000050'::uuid,
    '2025-07-29'::date,
    31,
    2025,
    'Eve Senior',
    'Manager',
    45.00,
    25.00
    WHERE NOT EXISTS (
    SELECT 1
    FROM timesheets
    WHERE timesheet_id = 'c5d6e7f8-9999-4d8a-0b1c-000000000015'::uuid
);
