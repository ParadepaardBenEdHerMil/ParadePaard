-- enable uuid generator
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Seed credentials:
-- Default Company admin users: ParadeAdmin123!
-- Default Company standard users: ParadeUser123!
-- Default Company super admin: ParadeSuper123!
-- testcompany2 admin and users: ParadeCompany2123!

-- companies table
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

INSERT INTO companies (id, name)
SELECT '00000000-0000-0000-0000-000000000002'::uuid, 'testcompany2'
    WHERE NOT EXISTS (
        SELECT 1 FROM companies
        WHERE id = '00000000-0000-0000-0000-000000000002'::uuid
           OR name = 'testcompany2'
    );

-- clean up old join tables if they exist
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS auth_user_roles;

-- users table matches the entity
CREATE TABLE IF NOT EXISTS "users" (
                                       id UUID PRIMARY KEY,
                                       first_name VARCHAR(255) NOT NULL,
                                       last_name VARCHAR(255) NOT NULL,
                                       email VARCHAR(255) NOT NULL,
                                       username VARCHAR(255) UNIQUE NOT NULL,
                                       password VARCHAR(255) NOT NULL,
                                       must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
                                       company_id UUID NOT NULL
    );

-- keep seed scripts compatible with existing databases
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
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
    password = COALESCE(password, '$2b$12$7hoRZfJrRKD2nIm2vHLs7OBETy.LWenXXMLKf99W8M4PUwO6KB7fu'),
    must_change_password = COALESCE(must_change_password, FALSE),
    company_id = COALESCE(company_id, '00000000-0000-0000-0000-000000000001'::uuid)
WHERE email IS NULL
   OR username IS NULL
   OR first_name IS NULL
   OR last_name IS NULL
   OR password IS NULL
   OR must_change_password IS NULL
   OR company_id IS NULL;

ALTER TABLE IF EXISTS "users" ALTER COLUMN email SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN username SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN last_name SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN password SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE IF EXISTS "users" DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS "users" DROP CONSTRAINT IF EXISTS users_company_email_key;
ALTER TABLE IF EXISTS "users" ADD CONSTRAINT users_company_email_key UNIQUE (company_id, email);

-- drop legacy column if it exists
ALTER TABLE "users" DROP COLUMN IF EXISTS role;

-- roles table uses uuid
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
ALTER TABLE IF EXISTS roles ADD CONSTRAINT roles_company_name_key UNIQUE (company_id, name);
UPDATE roles SET company_id = COALESCE(company_id, '00000000-0000-0000-0000-000000000001'::uuid)
    WHERE company_id IS NULL;
ALTER TABLE IF EXISTS roles ALTER COLUMN company_id SET NOT NULL;

-- permissions table uses uuid
CREATE TABLE IF NOT EXISTS permissions (
                                           id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) UNIQUE NOT NULL
    );

-- join table for roles -> permissions
CREATE TABLE IF NOT EXISTS role_permissions (
                                                 role_id UUID NOT NULL,
                                                 permission_id UUID NOT NULL,
                                                 PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );

-- join table that your entity maps to
CREATE TABLE IF NOT EXISTS auth_user_roles (
                                               user_id UUID NOT NULL,
                                               role_id UUID NOT NULL,
                                               PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_auth_user_roles_user FOREIGN KEY (user_id) REFERENCES "users"(id) ON DELETE CASCADE,
    CONSTRAINT fk_auth_user_roles_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

-- seed admin user
INSERT INTO "users" (id, first_name, last_name, email, username, password, company_id)
SELECT
    '223e4567-e89b-12d3-a456-426614174006'::uuid,
    'Test',
    'User',
    'testuser@test.com',
    'testuser',
    '$2b$12$7hoRZfJrRKD2nIm2vHLs7OBETy.LWenXXMLKf99W8M4PUwO6KB7fu',
    '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE id = '223e4567-e89b-12d3-a456-426614174006'::uuid
       OR (email = 'testuser@test.com' AND company_id = '00000000-0000-0000-0000-000000000001'::uuid)
       OR username = 'testuser'
);

-- seed standard user (matches user-service Jane Doe)
INSERT INTO "users" (id, first_name, last_name, email, username, password, company_id)
SELECT
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Jane',
    'Doe',
    'jane.doe@example.com',
    'jane.doe',
    '$2b$12$7hoRZfJrRKD2nIm2vHLs7OBETy.LWenXXMLKf99W8M4PUwO6KB7fu',
    '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE id = '11111111-1111-1111-1111-111111111111'::uuid
       OR (email = 'jane.doe@example.com' AND company_id = '00000000-0000-0000-0000-000000000001'::uuid)
       OR username = 'jane.doe'
);

-- seed Joost van Stam (matches user-service)
INSERT INTO "users" (id, first_name, last_name, email, username, password, company_id)
SELECT
    'b825a6bd-50d3-47e0-890d-78bfc59911b7'::uuid,
    'Joost',
    'van Stam',
    'joost.vanstam@example.com',
    'joost.vanstam',
    '$2b$12$7hoRZfJrRKD2nIm2vHLs7OBETy.LWenXXMLKf99W8M4PUwO6KB7fu',
    '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE id = 'b825a6bd-50d3-47e0-890d-78bfc59911b7'::uuid
       OR (email = 'joost.vanstam@example.com' AND company_id = '00000000-0000-0000-0000-000000000001'::uuid)
       OR username = 'joost.vanstam'
);

-- seed admin account (matches user-service)
INSERT INTO "users" (id, first_name, last_name, email, username, password, company_id)
SELECT
    '7b962433-6bde-4642-a011-5b56bf4f18e1'::uuid,
    'Sanne',
    'Admin',
    'sanne.admin@example.com',
    'sanne.admin',
    '$2b$12$7hoRZfJrRKD2nIm2vHLs7OBETy.LWenXXMLKf99W8M4PUwO6KB7fu',
    '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE id = '7b962433-6bde-4642-a011-5b56bf4f18e1'::uuid
       OR (email = 'sanne.admin@example.com' AND company_id = '00000000-0000-0000-0000-000000000001'::uuid)
       OR username = 'sanne.admin'
);

-- seed super admin account
INSERT INTO "users" (id, first_name, last_name, email, username, password, company_id)
SELECT
    '99999999-9999-9999-9999-999999999999'::uuid,
    'Super',
    'Admin',
    'super.admin@example.com',
    'super.admin',
    '$2b$12$7hoRZfJrRKD2nIm2vHLs7OBETy.LWenXXMLKf99W8M4PUwO6KB7fu',
    '00000000-0000-0000-0000-000000000001'::uuid
WHERE NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE id = '99999999-9999-9999-9999-999999999999'::uuid
       OR (email = 'super.admin@example.com' AND company_id = '00000000-0000-0000-0000-000000000001'::uuid)
       OR username = 'super.admin'
);

-- seed testcompany2 admin account
INSERT INTO "users" (id, first_name, last_name, email, username, password, company_id)
SELECT
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002'::uuid,
    'Super',
    'Admin',
    'superadmintestcompany2@example.com',
    'superadmintestcompany2',
    '$2b$12$1R8wo3m2pq6PPPfzvgw6IenkJgSMAy4Oh7JASaJduS8RrzhPSeGYa',
    '00000000-0000-0000-0000-000000000002'::uuid
WHERE NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002'::uuid
       OR (email = 'superadmintestcompany2@example.com' AND company_id = '00000000-0000-0000-0000-000000000002'::uuid)
       OR username = 'superadmintestcompany2'
);

-- seed testcompany2 users
INSERT INTO "users" (id, first_name, last_name, email, username, password, company_id)
SELECT
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002'::uuid,
    'Anna',
    'Tester',
    'anna.testcompany2@example.com',
    'anna.testcompany2',
    '$2b$12$1R8wo3m2pq6PPPfzvgw6IenkJgSMAy4Oh7JASaJduS8RrzhPSeGYa',
    '00000000-0000-0000-0000-000000000002'::uuid
WHERE NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002'::uuid
       OR (email = 'anna.testcompany2@example.com' AND company_id = '00000000-0000-0000-0000-000000000002'::uuid)
       OR username = 'anna.testcompany2'
);

INSERT INTO "users" (id, first_name, last_name, email, username, password, company_id)
SELECT
    'cccccccc-cccc-cccc-cccc-cccccccc0002'::uuid,
    'Ben',
    'Tester',
    'ben.testcompany2@example.com',
    'ben.testcompany2',
    '$2b$12$1R8wo3m2pq6PPPfzvgw6IenkJgSMAy4Oh7JASaJduS8RrzhPSeGYa',
    '00000000-0000-0000-0000-000000000002'::uuid
WHERE NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE id = 'cccccccc-cccc-cccc-cccc-cccccccc0002'::uuid
       OR (email = 'ben.testcompany2@example.com' AND company_id = '00000000-0000-0000-0000-000000000002'::uuid)
       OR username = 'ben.testcompany2'
);

-- enforce deterministic seeded passwords on existing databases too
UPDATE "users"
SET password = '$2b$12$HQ6WGmIHSyW.zourNrcJVOygqwNoHHt.YH6M89rdidxxKd8HyG3w6',
    must_change_password = FALSE
WHERE id IN (
    '223e4567-e89b-12d3-a456-426614174006'::uuid,
    '7b962433-6bde-4642-a011-5b56bf4f18e1'::uuid
);

UPDATE "users"
SET password = '$2b$12$CQGaTe/xATbUrzLA6pJCAucbG7tUm2QyY9aRw/dwxzH1h1Z9UvnHO',
    must_change_password = FALSE
WHERE id IN (
    '11111111-1111-1111-1111-111111111111'::uuid,
    'b825a6bd-50d3-47e0-890d-78bfc59911b7'::uuid
);

UPDATE "users"
SET password = '$2b$12$ZTkS2o5w9tulrSSP3Qj4euIa3I.T8kVE59ypXtQQP3yPRLYf3LHT2',
    must_change_password = FALSE
WHERE id = '99999999-9999-9999-9999-999999999999'::uuid;

UPDATE "users"
SET password = '$2b$12$BTjlYw1oe7vYpRu9./CTVu8c0h6uKdt5E1MkX4dBz2a2/oLw93r/6',
    must_change_password = FALSE
WHERE id IN (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002'::uuid,
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002'::uuid,
    'cccccccc-cccc-cccc-cccc-cccccccc0002'::uuid
);

-- seed roles
INSERT INTO roles (id, name, company_id)
SELECT '11111111-aaaa-aaaa-aaaa-111111111111'::uuid, 'ADMIN', '00000000-0000-0000-0000-000000000001'::uuid
    WHERE NOT EXISTS (
        SELECT 1 FROM roles
        WHERE id = '11111111-aaaa-aaaa-aaaa-111111111111'::uuid
           OR (name = 'ADMIN' AND company_id = '00000000-0000-0000-0000-000000000001'::uuid)
    );

INSERT INTO roles (id, name, company_id)
SELECT '22222222-bbbb-bbbb-bbbb-222222222222'::uuid, 'USER', '00000000-0000-0000-0000-000000000001'::uuid
    WHERE NOT EXISTS (
        SELECT 1 FROM roles
        WHERE id = '22222222-bbbb-bbbb-bbbb-222222222222'::uuid
           OR (name = 'USER' AND company_id = '00000000-0000-0000-0000-000000000001'::uuid)
    );

INSERT INTO roles (id, name, company_id)
SELECT '33333333-cccc-cccc-cccc-333333333333'::uuid, 'SUPER_ADMIN', '00000000-0000-0000-0000-000000000001'::uuid
    WHERE NOT EXISTS (
        SELECT 1 FROM roles
        WHERE id = '33333333-cccc-cccc-cccc-333333333333'::uuid
           OR (name = 'SUPER_ADMIN' AND company_id = '00000000-0000-0000-0000-000000000001'::uuid)
    );

INSERT INTO roles (id, name, company_id)
SELECT '44444444-dddd-dddd-dddd-444444444444'::uuid, 'ADMIN', '00000000-0000-0000-0000-000000000002'::uuid
    WHERE NOT EXISTS (
        SELECT 1 FROM roles
        WHERE id = '44444444-dddd-dddd-dddd-444444444444'::uuid
           OR (name = 'ADMIN' AND company_id = '00000000-0000-0000-0000-000000000002'::uuid)
    );

INSERT INTO roles (id, name, company_id)
SELECT '55555555-eeee-eeee-eeee-555555555555'::uuid, 'USER', '00000000-0000-0000-0000-000000000002'::uuid
    WHERE NOT EXISTS (
        SELECT 1 FROM roles
        WHERE id = '55555555-eeee-eeee-eeee-555555555555'::uuid
           OR (name = 'USER' AND company_id = '00000000-0000-0000-0000-000000000002'::uuid)
    );

-- seed permissions
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_ACCESS_ADMIN_DASHBOARD'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_ACCESS_ADMIN_DASHBOARD');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_CREATE_ROLE'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_CREATE_ROLE');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_ASSIGN_ROLES'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_ASSIGN_ROLES');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_EDIT_ROLES'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_EDIT_ROLES');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_REMOVE_ROLES'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_REMOVE_ROLES');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_DELETE_ROLES'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_DELETE_ROLES');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_CREATE_ADMIN'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_CREATE_ADMIN');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_VIEW_USERS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_VIEW_USERS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_MANAGE_USERS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_MANAGE_USERS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_MANAGE_COMPANY'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_MANAGE_COMPANY');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_ONBOARD_USERS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_ONBOARD_USERS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_COMPLETE_ONBOARDING'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_COMPLETE_ONBOARDING');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_VIEW_ALL_LEAVE_REQUESTS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_VIEW_ALL_LEAVE_REQUESTS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_MANAGE_LEAVE_REQUESTS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_MANAGE_LEAVE_REQUESTS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_APPROVE_LEAVE_REQUESTS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_APPROVE_LEAVE_REQUESTS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_REJECT_LEAVE_REQUESTS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_REJECT_LEAVE_REQUESTS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_VIEW_CONTRACTS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_VIEW_CONTRACTS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_VIEW_ONBOARDING_QUEUE'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_VIEW_ONBOARDING_QUEUE');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_REVIEW_ONBOARDING'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_REVIEW_ONBOARDING');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_VIEW_OWN_CONTRACTS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_VIEW_OWN_CONTRACTS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_SIGN_OWN_CONTRACTS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_SIGN_OWN_CONTRACTS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_VIEW_ALL_CONTRACTS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_VIEW_ALL_CONTRACTS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_MANAGE_CONTRACTS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_MANAGE_CONTRACTS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_REVIEW_CONTRACTS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_REVIEW_CONTRACTS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_FINALIZE_CONTRACT'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_FINALIZE_CONTRACT');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_VIEW_FUNCTIONS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_VIEW_FUNCTIONS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_MANAGE_FUNCTIONS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_MANAGE_FUNCTIONS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_VIEW_ALL_TIMESHEETS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_VIEW_ALL_TIMESHEETS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_VIEW_OWN_TIMESHEETS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_VIEW_OWN_TIMESHEETS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_MANAGE_TIMESHEETS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_MANAGE_TIMESHEETS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_VIEW_ALL_PAYSLIPS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_VIEW_ALL_PAYSLIPS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_VIEW_PAYSLIPS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_VIEW_PAYSLIPS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_REVIEW_PAYSLIPS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_REVIEW_PAYSLIPS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_MANAGE_PAYSLIPS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_MANAGE_PAYSLIPS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_REPORT_PAYSLIP_ERRORS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_REPORT_PAYSLIP_ERRORS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_MANAGE_PLANNING'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_MANAGE_PLANNING');

-- assign permissions to ADMIN role
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
    'CAN_MANAGE_PLANNING'
)
WHERE r.name = 'ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- assign permissions to USER role
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
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- assign all permissions to SUPER_ADMIN role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
         CROSS JOIN permissions p
WHERE r.name = 'SUPER_ADMIN'
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- give the admin user the ADMIN role
INSERT INTO auth_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM "users" u
         JOIN roles r ON r.name = 'ADMIN' AND r.company_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE u.id = '223e4567-e89b-12d3-a456-426614174006'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM auth_user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

-- give the standard user the USER role
INSERT INTO auth_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM "users" u
         JOIN roles r ON r.name = 'USER' AND r.company_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE u.id = '11111111-1111-1111-1111-111111111111'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM auth_user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

-- give Joost the USER role
INSERT INTO auth_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM "users" u
         JOIN roles r ON r.name = 'USER' AND r.company_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE u.id = 'b825a6bd-50d3-47e0-890d-78bfc59911b7'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM auth_user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

-- give Sanne the ADMIN role
INSERT INTO auth_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM "users" u
         JOIN roles r ON r.name = 'ADMIN' AND r.company_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE u.id = '7b962433-6bde-4642-a011-5b56bf4f18e1'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM auth_user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

-- give Super Admin the SUPER_ADMIN role
INSERT INTO auth_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM "users" u
         JOIN roles r ON r.name = 'SUPER_ADMIN' AND r.company_id = '00000000-0000-0000-0000-000000000001'::uuid
WHERE u.id = '99999999-9999-9999-9999-999999999999'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM auth_user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

-- give testcompany2 admin the ADMIN role
INSERT INTO auth_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM "users" u
         JOIN roles r ON r.name = 'ADMIN' AND r.company_id = '00000000-0000-0000-0000-000000000002'::uuid
WHERE u.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM auth_user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

-- give testcompany2 users the USER role
INSERT INTO auth_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM "users" u
         JOIN roles r ON r.name = 'USER' AND r.company_id = '00000000-0000-0000-0000-000000000002'::uuid
WHERE u.id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM auth_user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

INSERT INTO auth_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM "users" u
         JOIN roles r ON r.name = 'USER' AND r.company_id = '00000000-0000-0000-0000-000000000002'::uuid
WHERE u.id = 'cccccccc-cccc-cccc-cccc-cccccccc0002'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM auth_user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );
