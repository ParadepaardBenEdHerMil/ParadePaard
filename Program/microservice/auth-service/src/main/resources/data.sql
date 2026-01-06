-- enable uuid generator
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- clean up old join tables if they exist
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS auth_user_roles;

-- users table matches the entity
CREATE TABLE IF NOT EXISTS "users" (
                                       id UUID PRIMARY KEY,
                                       first_name VARCHAR(255) NOT NULL,
                                       last_name VARCHAR(255) NOT NULL,
                                       email VARCHAR(255) UNIQUE NOT NULL,
                                       username VARCHAR(255) UNIQUE NOT NULL,
                                       password VARCHAR(255) NOT NULL,
                                       must_change_password BOOLEAN NOT NULL DEFAULT FALSE
    );

-- keep seed scripts compatible with existing databases
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS first_name VARCHAR(255);
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS last_name VARCHAR(255);
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS username VARCHAR(255);
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE IF EXISTS "users" ADD COLUMN IF NOT EXISTS password VARCHAR(255);

UPDATE "users"
SET email = COALESCE(email, CONCAT('unknown_', id, '@example.com')),
    username = COALESCE(username, email, CONCAT('user_', id)),
    first_name = COALESCE(first_name, SPLIT_PART(email, '@', 1), 'Unknown'),
    last_name = COALESCE(last_name, 'User'),
    password = COALESCE(password, '$2b$12$7hoRZfJrRKD2nIm2vHLs7OBETy.LWenXXMLKf99W8M4PUwO6KB7fu'),
    must_change_password = COALESCE(must_change_password, FALSE)
WHERE email IS NULL
   OR username IS NULL
   OR first_name IS NULL
   OR last_name IS NULL
   OR password IS NULL
   OR must_change_password IS NULL;

ALTER TABLE IF EXISTS "users" ALTER COLUMN email SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN username SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN last_name SET NOT NULL;
ALTER TABLE IF EXISTS "users" ALTER COLUMN password SET NOT NULL;

-- drop legacy column if it exists
ALTER TABLE "users" DROP COLUMN IF EXISTS role;

-- roles table uses uuid
CREATE TABLE IF NOT EXISTS roles (
                                     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL
    );

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
INSERT INTO "users" (id, first_name, last_name, email, username, password)
SELECT
    '223e4567-e89b-12d3-a456-426614174006'::uuid,
    'Test',
    'User',
    'testuser@test.com',
    'testuser',
    '$2b$12$7hoRZfJrRKD2nIm2vHLs7OBETy.LWenXXMLKf99W8M4PUwO6KB7fu'
    WHERE NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE id = '223e4567-e89b-12d3-a456-426614174006'::uuid
       OR email = 'testuser@test.com'
       OR username = 'testuser'
);

-- seed standard user (matches user-service Jane Doe)
INSERT INTO "users" (id, first_name, last_name, email, username, password)
SELECT
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Jane',
    'Doe',
    'jane.doe@example.com',
    'jane.doe',
    '$2b$12$7hoRZfJrRKD2nIm2vHLs7OBETy.LWenXXMLKf99W8M4PUwO6KB7fu'
    WHERE NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE id = '11111111-1111-1111-1111-111111111111'::uuid
       OR email = 'jane.doe@example.com'
       OR username = 'jane.doe'
);

-- seed Joost van Stam (matches user-service)
INSERT INTO "users" (id, first_name, last_name, email, username, password)
SELECT
    'b825a6bd-50d3-47e0-890d-78bfc59911b7'::uuid,
    'Joost',
    'van Stam',
    'joost.vanstam@example.com',
    'joost.vanstam',
    '$2b$12$7hoRZfJrRKD2nIm2vHLs7OBETy.LWenXXMLKf99W8M4PUwO6KB7fu'
    WHERE NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE id = 'b825a6bd-50d3-47e0-890d-78bfc59911b7'::uuid
       OR email = 'joost.vanstam@example.com'
       OR username = 'joost.vanstam'
);

-- seed admin account (matches user-service)
INSERT INTO "users" (id, first_name, last_name, email, username, password)
SELECT
    '7b962433-6bde-4642-a011-5b56bf4f18e1'::uuid,
    'Sanne',
    'Admin',
    'sanne.admin@example.com',
    'sanne.admin',
    '$2b$12$7hoRZfJrRKD2nIm2vHLs7OBETy.LWenXXMLKf99W8M4PUwO6KB7fu'
    WHERE NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE id = '7b962433-6bde-4642-a011-5b56bf4f18e1'::uuid
       OR email = 'sanne.admin@example.com'
       OR username = 'sanne.admin'
);

-- seed super admin account
INSERT INTO "users" (id, first_name, last_name, email, username, password)
SELECT
    '99999999-9999-9999-9999-999999999999'::uuid,
    'Super',
    'Admin',
    'super.admin@example.com',
    'super.admin',
    '$2b$12$7hoRZfJrRKD2nIm2vHLs7OBETy.LWenXXMLKf99W8M4PUwO6KB7fu'
    WHERE NOT EXISTS (
    SELECT 1 FROM "users"
    WHERE id = '99999999-9999-9999-9999-999999999999'::uuid
       OR email = 'super.admin@example.com'
       OR username = 'super.admin'
);

-- seed roles
INSERT INTO roles (id, name)
SELECT '11111111-aaaa-aaaa-aaaa-111111111111'::uuid, 'ADMIN'
    WHERE NOT EXISTS (
        SELECT 1 FROM roles
        WHERE id = '11111111-aaaa-aaaa-aaaa-111111111111'::uuid OR name = 'ADMIN'
    );

INSERT INTO roles (id, name)
SELECT '22222222-bbbb-bbbb-bbbb-222222222222'::uuid, 'USER'
    WHERE NOT EXISTS (
        SELECT 1 FROM roles
        WHERE id = '22222222-bbbb-bbbb-bbbb-222222222222'::uuid OR name = 'USER'
    );

INSERT INTO roles (id, name)
SELECT '33333333-cccc-cccc-cccc-333333333333'::uuid, 'SUPER_ADMIN'
    WHERE NOT EXISTS (
        SELECT 1 FROM roles
        WHERE id = '33333333-cccc-cccc-cccc-333333333333'::uuid OR name = 'SUPER_ADMIN'
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
SELECT gen_random_uuid(), 'CAN_CREATE_ADMIN'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_CREATE_ADMIN');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_VIEW_USERS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_VIEW_USERS');
INSERT INTO permissions (id, name)
SELECT gen_random_uuid(), 'CAN_MANAGE_USERS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_MANAGE_USERS');
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
SELECT gen_random_uuid(), 'CAN_MANAGE_CONTRACTS'
    WHERE NOT EXISTS (SELECT 1 FROM permissions WHERE name = 'CAN_MANAGE_CONTRACTS');
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

-- assign permissions to ADMIN role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
         JOIN permissions p ON p.name IN (
    'CAN_ACCESS_ADMIN_DASHBOARD',
    'CAN_CREATE_ROLE',
    'CAN_ASSIGN_ROLES',
    'CAN_VIEW_USERS',
    'CAN_MANAGE_USERS',
    'CAN_ONBOARD_USERS',
    'CAN_VIEW_ALL_LEAVE_REQUESTS',
    'CAN_MANAGE_LEAVE_REQUESTS',
    'CAN_APPROVE_LEAVE_REQUESTS',
    'CAN_REJECT_LEAVE_REQUESTS',
    'CAN_VIEW_CONTRACTS',
    'CAN_MANAGE_CONTRACTS',
    'CAN_FINALIZE_CONTRACT',
    'CAN_VIEW_FUNCTIONS',
    'CAN_MANAGE_FUNCTIONS',
    'CAN_VIEW_ALL_TIMESHEETS',
    'CAN_MANAGE_TIMESHEETS',
    'CAN_VIEW_ALL_PAYSLIPS',
    'CAN_REVIEW_PAYSLIPS',
    'CAN_MANAGE_PAYSLIPS'
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
    'CAN_FINALIZE_CONTRACT',
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
         JOIN roles r ON r.name = 'ADMIN'
WHERE u.id = '223e4567-e89b-12d3-a456-426614174006'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM auth_user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

-- give the standard user the USER role
INSERT INTO auth_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM "users" u
         JOIN roles r ON r.name = 'USER'
WHERE u.id = '11111111-1111-1111-1111-111111111111'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM auth_user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

-- give Joost the USER role
INSERT INTO auth_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM "users" u
         JOIN roles r ON r.name = 'USER'
WHERE u.id = 'b825a6bd-50d3-47e0-890d-78bfc59911b7'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM auth_user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

-- give Sanne the ADMIN role
INSERT INTO auth_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM "users" u
         JOIN roles r ON r.name = 'ADMIN'
WHERE u.id = '7b962433-6bde-4642-a011-5b56bf4f18e1'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM auth_user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );

-- give Super Admin the SUPER_ADMIN role
INSERT INTO auth_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM "users" u
         JOIN roles r ON r.name = 'SUPER_ADMIN'
WHERE u.id = '99999999-9999-9999-9999-999999999999'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM auth_user_roles ur
      WHERE ur.user_id = u.id AND ur.role_id = r.id
  );
