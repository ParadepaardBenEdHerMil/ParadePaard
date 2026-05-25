CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Seed credentials:
-- Default Company admin user: ParadeAdmin123!

CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL
);

INSERT INTO companies (id, name)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'Default Company'
WHERE NOT EXISTS (
    SELECT 1 FROM companies
    WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
       OR name = 'Default Company'
);

DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS auth_user_roles;

CREATE TABLE IF NOT EXISTS "users" (
    id UUID PRIMARY KEY,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
    disabled BOOLEAN NOT NULL DEFAULT FALSE,
    company_id UUID NOT NULL
);

ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS disabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS username VARCHAR(255);
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS password VARCHAR(255);
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS company_id UUID;

UPDATE "users"
SET email = COALESCE(email, CONCAT('unknown_', id, '@example.com')),
    username = COALESCE(username, email, CONCAT('user_', id)),
    first_name = COALESCE(first_name, SPLIT_PART(email, '@', 1), 'Unknown'),
    last_name = COALESCE(last_name, 'User'),
    password = COALESCE(password, '$2b$12$HQ6WGmIHSyW.zourNrcJVOygqwNoHHt.YH6M89rdidxxKd8HyG3w6'),
    must_change_password = COALESCE(must_change_password, FALSE),
    disabled = COALESCE(disabled, FALSE),
    company_id = COALESCE(company_id, '00000000-0000-0000-0000-000000000001'::uuid)
WHERE email IS NULL
   OR username IS NULL
   OR first_name IS NULL
   OR last_name IS NULL
   OR password IS NULL
   OR must_change_password IS NULL
   OR disabled IS NULL
   OR company_id IS NULL;

ALTER TABLE IF EXISTS "users" ALTER COLUMN email SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN username SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN last_name SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN password SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN disabled SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE IF EXISTS "users" DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS "users" DROP CONSTRAINT IF EXISTS users_company_email_key;
ALTER TABLE IF EXISTS "users" ADD CONSTRAINT users_company_email_key UNIQUE (company_id, email);
ALTER TABLE "users" DROP COLUMN IF EXISTS role;

CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL,
    color VARCHAR(24),
    company_id UUID NOT NULL
);

ALTER TABLE IF EXISTS roles ADD COLUMN IF NOT EXISTS color VARCHAR(24);
ALTER TABLE IF EXISTS roles ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE IF EXISTS roles DROP CONSTRAINT IF EXISTS roles_name_key;
ALTER TABLE IF EXISTS roles DROP CONSTRAINT IF EXISTS roles_company_name_key;
ALTER TABLE IF EXISTS roles DROP CONSTRAINT IF EXISTS ukofx66keruapi6vyqpv6f2or37;
ALTER TABLE IF EXISTS roles DROP CONSTRAINT IF EXISTS ukanola7uuuwuuc18cy62q3sj43;
UPDATE roles SET company_id = COALESCE(company_id, '00000000-0000-0000-0000-000000000001'::uuid)
WHERE company_id IS NULL;
ALTER TABLE IF EXISTS roles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE IF EXISTS roles ADD CONSTRAINT roles_company_name_key UNIQUE (company_id, name);

CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id UUID NOT NULL,
    permission_id UUID NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_user_roles (
    user_id UUID NOT NULL,
    role_id UUID NOT NULL,
    PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_auth_user_roles_user FOREIGN KEY (user_id) REFERENCES "users"(id) ON DELETE CASCADE,
    CONSTRAINT fk_auth_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

DELETE FROM role_permissions rp
USING roles r
WHERE rp.role_id = r.id
  AND r.company_id <> '00000000-0000-0000-0000-000000000001'::uuid;

DELETE FROM roles
WHERE company_id <> '00000000-0000-0000-0000-000000000001'::uuid;

DELETE FROM "users"
WHERE id <> '7b962433-6bde-4642-a011-5b56bf4f18e1'::uuid;

DELETE FROM companies
WHERE id <> '00000000-0000-0000-0000-000000000001'::uuid;

INSERT INTO "users" (id, first_name, last_name, email, username, password, company_id, must_change_password, disabled)
VALUES (
    '7b962433-6bde-4642-a011-5b56bf4f18e1'::uuid,
    'Sanne',
    'Admin',
    'sanne.admin@example.com',
    'sanne.admin',
    '$2b$12$HQ6WGmIHSyW.zourNrcJVOygqwNoHHt.YH6M89rdidxxKd8HyG3w6',
    '00000000-0000-0000-0000-000000000001'::uuid,
    FALSE,
    FALSE
)
ON CONFLICT (id) DO UPDATE
SET first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    username = EXCLUDED.username,
    password = EXCLUDED.password,
    company_id = EXCLUDED.company_id,
    must_change_password = FALSE,
    disabled = FALSE;

INSERT INTO roles (id, name, company_id)
VALUES
    ('11111111-aaaa-aaaa-aaaa-111111111111'::uuid, 'ADMIN', '00000000-0000-0000-0000-000000000001'::uuid),
    ('22222222-bbbb-bbbb-bbbb-222222222222'::uuid, 'USER', '00000000-0000-0000-0000-000000000001'::uuid),
    ('33333333-cccc-cccc-cccc-333333333333'::uuid, 'SUPER_ADMIN', '00000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT DO NOTHING;

INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), permission_name
FROM (VALUES
    ('CAN_ACCESS_ADMIN_DASHBOARD'),
    ('CAN_CREATE_ROLE'),
    ('CAN_ASSIGN_ROLES'),
    ('CAN_EDIT_ROLES'),
    ('CAN_REMOVE_ROLES'),
    ('CAN_DELETE_ROLES'),
    ('CAN_CREATE_ADMIN'),
    ('CAN_VIEW_USERS'),
    ('CAN_MANAGE_USERS'),
    ('CAN_MANAGE_COMPANY'),
    ('CAN_ONBOARD_USERS'),
    ('CAN_COMPLETE_ONBOARDING'),
    ('CAN_VIEW_ALL_LEAVE_REQUESTS'),
    ('CAN_MANAGE_LEAVE_REQUESTS'),
    ('CAN_APPROVE_LEAVE_REQUESTS'),
    ('CAN_REJECT_LEAVE_REQUESTS'),
    ('CAN_VIEW_CONTRACTS'),
    ('CAN_VIEW_ONBOARDING_QUEUE'),
    ('CAN_REVIEW_ONBOARDING'),
    ('CAN_VIEW_APPLICATIONS'),
    ('CAN_REVIEW_APPLICATIONS'),
    ('CAN_VIEW_OWN_CONTRACTS'),
    ('CAN_SIGN_OWN_CONTRACTS'),
    ('CAN_VIEW_ALL_CONTRACTS'),
    ('CAN_MANAGE_CONTRACTS'),
    ('CAN_REVIEW_CONTRACTS'),
    ('CAN_FINALIZE_CONTRACT'),
    ('CAN_VIEW_FUNCTIONS'),
    ('CAN_MANAGE_FUNCTIONS'),
    ('CAN_VIEW_ALL_TIMESHEETS'),
    ('CAN_VIEW_OWN_TIMESHEETS'),
    ('CAN_MANAGE_TIMESHEETS'),
    ('CAN_VIEW_ALL_PAYSLIPS'),
    ('CAN_VIEW_PAYSLIPS'),
    ('CAN_REVIEW_PAYSLIPS'),
    ('CAN_MANAGE_PAYSLIPS'),
    ('CAN_REPORT_PAYSLIP_ERRORS'),
    ('CAN_MANAGE_MESSAGES'),
    ('CAN_MANAGE_PLANNING'),
    ('CAN_VIEW_PAYROLL_FINANCE'),
    ('CAN_MANAGE_PAYROLL_FINANCE')
) AS seed(permission_name)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = seed.permission_name);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
    'CAN_ACCESS_ADMIN_DASHBOARD',
    'CAN_CREATE_ROLE',
    'CAN_ASSIGN_ROLES',
    'CAN_EDIT_ROLES',
    'CAN_REMOVE_ROLES',
    'CAN_DELETE_ROLES',
    'CAN_CREATE_ADMIN',
    'CAN_VIEW_USERS',
    'CAN_MANAGE_USERS',
    'CAN_MANAGE_COMPANY',
    'CAN_ONBOARD_USERS',
    'CAN_VIEW_ALL_LEAVE_REQUESTS',
    'CAN_MANAGE_LEAVE_REQUESTS',
    'CAN_APPROVE_LEAVE_REQUESTS',
    'CAN_REJECT_LEAVE_REQUESTS',
    'CAN_VIEW_CONTRACTS',
    'CAN_VIEW_ONBOARDING_QUEUE',
    'CAN_REVIEW_ONBOARDING',
    'CAN_VIEW_APPLICATIONS',
    'CAN_REVIEW_APPLICATIONS',
    'CAN_VIEW_OWN_CONTRACTS',
    'CAN_SIGN_OWN_CONTRACTS',
    'CAN_VIEW_ALL_CONTRACTS',
    'CAN_MANAGE_CONTRACTS',
    'CAN_REVIEW_CONTRACTS',
    'CAN_FINALIZE_CONTRACT',
    'CAN_VIEW_FUNCTIONS',
    'CAN_MANAGE_FUNCTIONS',
    'CAN_VIEW_ALL_TIMESHEETS',
    'CAN_MANAGE_TIMESHEETS',
    'CAN_VIEW_ALL_PAYSLIPS',
    'CAN_REVIEW_PAYSLIPS',
    'CAN_MANAGE_PAYSLIPS',
    'CAN_MANAGE_MESSAGES',
    'CAN_MANAGE_PLANNING',
    'CAN_VIEW_PAYROLL_FINANCE',
    'CAN_MANAGE_PAYROLL_FINANCE'
)
WHERE r.name = 'ADMIN'
  AND r.company_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

DELETE FROM role_permissions rp
USING roles r, permissions p
WHERE rp.role_id = r.id
  AND rp.permission_id = p.id
  AND r.name = 'USER'
  AND p.name NOT IN (
    'CAN_COMPLETE_ONBOARDING',
    'CAN_VIEW_OWN_CONTRACTS',
    'CAN_SIGN_OWN_CONTRACTS',
    'CAN_VIEW_PAYSLIPS',
    'CAN_REPORT_PAYSLIP_ERRORS',
    'CAN_VIEW_OWN_TIMESHEETS'
);

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN (
    'CAN_COMPLETE_ONBOARDING',
    'CAN_VIEW_OWN_CONTRACTS',
    'CAN_SIGN_OWN_CONTRACTS',
    'CAN_VIEW_PAYSLIPS',
    'CAN_REPORT_PAYSLIP_ERRORS',
    'CAN_VIEW_OWN_TIMESHEETS'
)
WHERE r.name = 'USER'
  AND r.company_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN'
  AND r.company_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

INSERT INTO auth_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM "users" u
JOIN roles r ON r.name = 'ADMIN' AND r.company_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE u.id = '7b962433-6bde-4642-a011-5b56bf4f18e1'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM auth_user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );
