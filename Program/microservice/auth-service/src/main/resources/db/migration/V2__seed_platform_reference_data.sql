-- V2: platform reference data for auth-service.
--
-- B6 (seed data): the default platform company plus the ADMIN / USER / SUPER_ADMIN
-- roles and the permission catalogue with their role assignments. This is reference
-- data the application requires to function (AdminBootstrapRunner creates the first
-- admin against the SUPER_ADMIN role seeded here), not per-tenant user data. Every
-- statement is idempotent (WHERE NOT EXISTS / ON CONFLICT DO NOTHING) so it is safe
-- to re-run and safe against a database that was baselined from an existing schema.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO companies (id, name)
SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'Platform Sandbox Company'
WHERE NOT EXISTS (
    SELECT 1 FROM companies
    WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
       OR name = 'Platform Sandbox Company'
);

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
    ('CAN_DELETE_USERS'),
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
    ('CAN_VIEW_BILLING_RATES'),
    ('CAN_MANAGE_BILLING_RATES'),
    ('CAN_VIEW_PAYROLL_FINANCE'),
    ('CAN_MANAGE_PAYROLL_FINANCE'),
    ('CAN_VIEW_EMPLOYEE_IDENTIFICATION'),
    ('CAN_MANAGE_PLATFORM')
) AS seed(permission_name)
WHERE NOT EXISTS (SELECT 1 FROM permissions p WHERE p.name = seed.permission_name);

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
    'CAN_CREATE_ADMIN',
    'CAN_VIEW_USERS',
    'CAN_MANAGE_USERS',
    'CAN_DELETE_USERS',
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
    'CAN_VIEW_BILLING_RATES',
    'CAN_MANAGE_BILLING_RATES',
    'CAN_VIEW_PAYROLL_FINANCE',
    'CAN_MANAGE_PAYROLL_FINANCE',
    'CAN_VIEW_EMPLOYEE_IDENTIFICATION'
)
WHERE r.name = 'ADMIN'
  AND r.company_id = '00000000-0000-0000-0000-000000000001'::uuid
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
  AND r.company_id = '00000000-0000-0000-0000-000000000001'::uuid
  AND NOT EXISTS (
      SELECT 1 FROM role_permissions rp
      WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- SUPER_ADMIN gets every permission
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
