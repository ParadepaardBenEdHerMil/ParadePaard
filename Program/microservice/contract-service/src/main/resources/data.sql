/* ------------------------------------------------------------------
   TABLE DEFINITIONS
   ------------------------------------------------------------------ */
CREATE TABLE IF NOT EXISTS functions
(
    function_id   UUID PRIMARY KEY,
    function_name VARCHAR(255) NOT NULL,
    hourly_wage   NUMERIC(19,2) NOT NULL
    );

/* ------------------------------------------------------------------
   FUNCTIONS
   ------------------------------------------------------------------ */

/* Junior Developer */
INSERT INTO functions (
    function_id,
    function_name,
    hourly_wage
)
SELECT
    'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
    'Junior Developer',
    25.00
    WHERE NOT EXISTS (
    SELECT 1 FROM functions WHERE function_id = 'aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid
);

/* Senior Developer */
INSERT INTO functions (
    function_id,
    function_name,
    hourly_wage
)
SELECT
    'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
    'Senior Developer',
    45.00
    WHERE NOT EXISTS (
    SELECT 1 FROM functions WHERE function_id = 'bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid
);

/* Project Manager */
INSERT INTO functions (
    function_id,
    function_name,
    hourly_wage
)
SELECT
    'ccccccc3-cccc-cccc-cccc-cccccccccccc'::uuid,
    'Project Manager',
    60.00
    WHERE NOT EXISTS (
    SELECT 1 FROM functions WHERE function_id = 'ccccccc3-cccc-cccc-cccc-cccccccccccc'::uuid
);

/* Tester */
INSERT INTO functions (
    function_id,
    function_name,
    hourly_wage
)
SELECT
    'ddddddd4-dddd-dddd-dddd-dddddddddddd'::uuid,
    'Tester',
    30.00
    WHERE NOT EXISTS (
    SELECT 1 FROM functions WHERE function_id = 'ddddddd4-dddd-dddd-dddd-dddddddddddd'::uuid
);
