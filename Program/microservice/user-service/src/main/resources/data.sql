-- Keep seed scripts compatible with existing databases (e.g. when the table was created
-- before new columns were added).
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    payout_frequency_minutes INTEGER NOT NULL DEFAULT 10080,
    logo_bytes BYTEA,
    logo_content_type VARCHAR(255),
    timesheet_logging_mode VARCHAR(32) NOT NULL DEFAULT 'ADMIN_FINALIZE',
    travel_claim_mode VARCHAR(32) NOT NULL DEFAULT 'REQUIRES_APPROVAL',
    payroll_tax_templates_json TEXT
);

ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS logo_bytes BYTEA;
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS logo_content_type VARCHAR(255);
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS timesheet_logging_mode VARCHAR(32) NOT NULL DEFAULT 'ADMIN_FINALIZE';
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS travel_claim_mode VARCHAR(32) NOT NULL DEFAULT 'REQUIRES_APPROVAL';
ALTER TABLE IF EXISTS companies ADD COLUMN IF NOT EXISTS payroll_tax_templates_json TEXT;
UPDATE companies
SET timesheet_logging_mode = COALESCE(timesheet_logging_mode, 'ADMIN_FINALIZE'),
    travel_claim_mode = COALESCE(travel_claim_mode, 'REQUIRES_APPROVAL');

INSERT INTO companies (id, name, payout_frequency_minutes, timesheet_logging_mode, travel_claim_mode)
SELECT CAST('00000000-0000-0000-0000-000000000001' AS UUID), 'Default Company', 10080, 'ADMIN_FINALIZE', 'REQUIRES_APPROVAL'
    WHERE NOT EXISTS (
        SELECT 1 FROM companies
        WHERE id = CAST('00000000-0000-0000-0000-000000000001' AS UUID)
           OR name = 'Default Company'
    );

INSERT INTO companies (id, name, payout_frequency_minutes, timesheet_logging_mode, travel_claim_mode)
SELECT CAST('00000000-0000-0000-0000-000000000002' AS UUID), 'testcompany2', 10080, 'ADMIN_FINALIZE', 'REQUIRES_APPROVAL'
    WHERE NOT EXISTS (
        SELECT 1 FROM companies
        WHERE id = CAST('00000000-0000-0000-0000-000000000002' AS UUID)
           OR name = 'testcompany2'
    );

CREATE TABLE IF NOT EXISTS job_applications (
    application_id UUID PRIMARY KEY,
    first_names VARCHAR(255) NOT NULL,
    preferred_name VARCHAR(255),
    middle_name_prefix VARCHAR(255),
    last_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(255) NOT NULL,
    date_of_birth DATE NOT NULL,
    gender VARCHAR(255),
    nationality VARCHAR(255),
    city VARCHAR(255),
    country VARCHAR(255),
    role_interest VARCHAR(255),
    contract_preference VARCHAR(255),
    available_from DATE,
    note VARCHAR(2000),
    availability_notes VARCHAR(2000),
    worked_for_us_before BOOLEAN NOT NULL DEFAULT FALSE,
    experience VARCHAR(4000),
    languages VARCHAR(1000),
    certificates VARCHAR(2000),
    motivation VARCHAR(4000),
    contact_consent BOOLEAN NOT NULL DEFAULT FALSE,
    information_accurate BOOLEAN NOT NULL DEFAULT FALSE,
    cv_file_name VARCHAR(255),
    cv_content_type VARCHAR(255),
    cv_bytes BYTEA,
    status VARCHAR(64) NOT NULL DEFAULT 'APPLICATION_SUBMITTED',
    review_note VARCHAR(4000),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by_user_id VARCHAR(255),
    decision_email_sent BOOLEAN,
    accepted_user_id UUID,
    submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS job_applications ADD COLUMN IF NOT EXISTS note VARCHAR(2000);
ALTER TABLE IF EXISTS job_applications ADD COLUMN IF NOT EXISTS availability_notes VARCHAR(2000);
UPDATE job_applications
SET note = COALESCE(note, availability_notes)
WHERE availability_notes IS NOT NULL;
ALTER TABLE IF EXISTS job_applications DROP COLUMN IF EXISTS availability_notes;
ALTER TABLE IF EXISTS job_applications DROP COLUMN IF EXISTS experience;
ALTER TABLE IF EXISTS job_applications DROP COLUMN IF EXISTS languages;
ALTER TABLE IF EXISTS job_applications DROP COLUMN IF EXISTS certificates;
ALTER TABLE IF EXISTS job_applications DROP COLUMN IF EXISTS motivation;

ALTER TABLE IF EXISTS job_applications DROP CONSTRAINT IF EXISTS job_applications_status_check;
ALTER TABLE IF EXISTS job_applications ADD CONSTRAINT job_applications_status_check CHECK (status IN (
    'APPLICATION_SUBMITTED',
    'APPLICATION_DENIED',
    'APPLICATION_ACCEPTED'
));

CREATE TABLE IF NOT EXISTS message_conversations (
    conversation_id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    company_id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP WITH TIME ZONE,
    last_message_preview VARCHAR(500),
    unread_by_admin_count INTEGER NOT NULL DEFAULT 0,
    unread_by_user_count INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT message_conversations_company_user_key UNIQUE (company_id, user_id)
);

CREATE TABLE IF NOT EXISTS message_entries (
    message_id UUID PRIMARY KEY,
    conversation_id UUID NOT NULL,
    sender_type VARCHAR(32) NOT NULL,
    sender_user_id UUID NOT NULL,
    body VARCHAR(4000) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE IF EXISTS message_entries DROP CONSTRAINT IF EXISTS message_entries_sender_type_check;
ALTER TABLE IF EXISTS message_entries ADD CONSTRAINT message_entries_sender_type_check CHECK (sender_type IN (
    'USER',
    'ADMIN'
));

ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS position VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS worked_for_us_before BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS payslip_frequency_minutes INTEGER NOT NULL DEFAULT 10080;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS company_id UUID;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS status VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS registered_date DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS nationality VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS bank_account_holder_name VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS bsn VARCHAR(32);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS apply_loonheffingskorting BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS pension_participant BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS special_zvw_contribution BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS payroll_notes VARCHAR(2000);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_document_type VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_document_number VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_issue_date DATE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_expiration_date DATE;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_issuing_country VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_document_image BYTEA;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS id_document_image_content_type VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS emergency_contact_email VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS onboarding_review_decision VARCHAR(255);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS onboarding_review_note VARCHAR(2000);
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS onboarding_review_checked_sections_json TEXT;
ALTER TABLE IF EXISTS users ADD COLUMN IF NOT EXISTS onboarding_review_contract_setup_json TEXT;
ALTER TABLE IF EXISTS users ALTER COLUMN registered_date SET DEFAULT CURRENT_DATE;

UPDATE users SET status = 'PENDING_SETUP' WHERE status IS NULL;
UPDATE users SET company_id = COALESCE(company_id, CAST('00000000-0000-0000-0000-000000000001' AS UUID))
    WHERE company_id IS NULL;
ALTER TABLE IF EXISTS users ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_status_check;
	ALTER TABLE IF EXISTS users ADD CONSTRAINT users_status_check CHECK (status IN (
	    'PENDING_SETUP',
	    'PENDING_PROFILE_REVIEW',
	    'CHANGES_REQUESTED',
	    'PENDING_CONTRACT_SIGNATURE',
	    'PENDING_CONTRACT_REVIEW',
	    'ACTIVE',
	    'REJECTED'
	));
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_company_email_key;
ALTER TABLE IF EXISTS users ADD CONSTRAINT users_company_email_key UNIQUE (company_id, email);

INSERT INTO users (user_id, email, preferred_name, first_names, middle_name_prefix, last_name, gender, date_of_birth, mobile_number, position, worked_for_us_before, street, house_number, house_number_suffix, postal_code, city, country, iban, payslip_frequency_minutes, status, company_id)
SELECT '11111111-1111-1111-1111-111111111111',
       'jane.doe@example.com',
       'Jane',
       'Jane Maria',
       NULL,
       'Doe',
       'FEMALE',
       '1992-04-12',
       '0611111111',
       'BAR',
       false,
       'Lindelaan',
       '10',
       'A',
       '3582 AB',
       'Utrecht',
       'Netherlands',
       'NL91ABNA0417164300',
       15,
       'ACTIVE',
       CAST('00000000-0000-0000-0000-000000000001' AS UUID)
    WHERE NOT EXISTS (
        SELECT 1 FROM users
        WHERE user_id = '11111111-1111-1111-1111-111111111111'
           OR (email = 'jane.doe@example.com' AND company_id = CAST('00000000-0000-0000-0000-000000000001' AS UUID))
    );

INSERT INTO users (user_id, email, preferred_name, first_names, middle_name_prefix, last_name, gender, date_of_birth, mobile_number, position, worked_for_us_before, street, house_number, house_number_suffix, postal_code, city, country, iban, payslip_frequency_minutes, status, company_id)
SELECT '22222222-2222-2222-2222-222222222222',
       'mark.vos@example.com',
       'Mark',
       'Mark Pieter',
       'van',
       'Vos',
       'MALE',
       '1988-09-22',
       '0622222222',
       'RUNNER',
       true,
       'Eikenstraat',
       '45',
       NULL,
       '1017 CD',
       'Amsterdam',
       'Netherlands',
       'DE89370400440532013000',
       10080,
       'PENDING_SETUP',
       CAST('00000000-0000-0000-0000-000000000001' AS UUID)
    WHERE NOT EXISTS (
        SELECT 1 FROM users
        WHERE user_id = '22222222-2222-2222-2222-222222222222'
           OR (email = 'mark.vos@example.com' AND company_id = CAST('00000000-0000-0000-0000-000000000001' AS UUID))
    );

INSERT INTO users (user_id, email, preferred_name, first_names, middle_name_prefix, last_name, gender, date_of_birth, mobile_number, position, worked_for_us_before, street, house_number, house_number_suffix, postal_code, city, country, iban, payslip_frequency_minutes, status, company_id)
SELECT '223e4567-e89b-12d3-a456-426614174006',
       'testuser@test.com',
       'Test',
       'Test',
       NULL,
       'User',
       'OTHER',
       '1990-01-01',
       '0600000000',
       'BAR',
       false,
       'Teststraat',
       '1',
       NULL,
       '1000 AA',
       'Amsterdam',
       'Netherlands',
       'NL00TEST0123456789',
       15,
       'ACTIVE',
       CAST('00000000-0000-0000-0000-000000000001' AS UUID)
    WHERE NOT EXISTS (
        SELECT 1 FROM users
        WHERE user_id = '223e4567-e89b-12d3-a456-426614174006'
           OR (email = 'testuser@test.com' AND company_id = CAST('00000000-0000-0000-0000-000000000001' AS UUID))
    );

INSERT INTO users (user_id, email, preferred_name, first_names, middle_name_prefix, last_name, gender, date_of_birth, mobile_number, position, worked_for_us_before, street, house_number, house_number_suffix, postal_code, city, country, iban, payslip_frequency_minutes, status, company_id)
SELECT 'b825a6bd-50d3-47e0-890d-78bfc59911b7',
       'joost.vanstam@example.com',
       'Joost',
       'Joost Pieter',
       'van',
       'Stam',
       'MALE',
       '1991-08-19',
       '0612345678',
       'RUNNER',
       false,
       'Kerkstraat',
       '12',
       'B',
       '1017 GA',
       'Amsterdam',
       'Netherlands',
       'NL12RABO3456789012',
       10080,
       'ACTIVE',
       CAST('00000000-0000-0000-0000-000000000001' AS UUID)
    WHERE NOT EXISTS (
        SELECT 1 FROM users
        WHERE user_id = 'b825a6bd-50d3-47e0-890d-78bfc59911b7'
           OR (email = 'joost.vanstam@example.com' AND company_id = CAST('00000000-0000-0000-0000-000000000001' AS UUID))
    );

INSERT INTO users (user_id, email, preferred_name, first_names, middle_name_prefix, last_name, gender, date_of_birth, mobile_number, position, worked_for_us_before, street, house_number, house_number_suffix, postal_code, city, country, iban, payslip_frequency_minutes, status, company_id)
SELECT '7b962433-6bde-4642-a011-5b56bf4f18e1',
       'sanne.admin@example.com',
       'Sanne',
       'Sanne',
       NULL,
       'Admin',
       'FEMALE',
       '1989-05-03',
       '0612349999',
       'MANAGER',
       true,
       'Herengracht',
       '120',
       NULL,
       '1015 BS',
       'Amsterdam',
       'Netherlands',
       'NL34INGB0987654321',
       10080,
       'ACTIVE',
       CAST('00000000-0000-0000-0000-000000000001' AS UUID)
    WHERE NOT EXISTS (
        SELECT 1 FROM users
        WHERE user_id = '7b962433-6bde-4642-a011-5b56bf4f18e1'
           OR (email = 'sanne.admin@example.com' AND company_id = CAST('00000000-0000-0000-0000-000000000001' AS UUID))
    );

INSERT INTO users (user_id, email, preferred_name, first_names, middle_name_prefix, last_name, gender, date_of_birth, mobile_number, position, worked_for_us_before, street, house_number, house_number_suffix, postal_code, city, country, iban, payslip_frequency_minutes, status, company_id)
SELECT '99999999-9999-9999-9999-999999999999',
       'super.admin@example.com',
       'Super',
       'Super',
       NULL,
       'Admin',
       'OTHER',
       '1985-01-01',
       '0600009999',
       'DIRECTOR',
       true,
       'Keizersgracht',
       '1',
       NULL,
       '1015 CJ',
       'Amsterdam',
       'Netherlands',
       'NL12ABNA0123456789',
       10080,
       'ACTIVE',
       CAST('00000000-0000-0000-0000-000000000001' AS UUID)
    WHERE NOT EXISTS (
        SELECT 1 FROM users
        WHERE user_id = '99999999-9999-9999-9999-999999999999'
           OR (email = 'super.admin@example.com' AND company_id = CAST('00000000-0000-0000-0000-000000000001' AS UUID))
    );

INSERT INTO users (user_id, email, preferred_name, first_names, middle_name_prefix, last_name, gender, date_of_birth, mobile_number, position, worked_for_us_before, street, house_number, house_number_suffix, postal_code, city, country, iban, payslip_frequency_minutes, status, company_id)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002',
       'superadmintestcompany2@example.com',
       'Super Admin',
       'Super',
       NULL,
       'Admin',
       'OTHER',
       '1984-02-02',
       '0600000002',
       'MANAGER',
       true,
       'Testlaan',
       '2',
       NULL,
       '2000 AA',
       'Rotterdam',
       'Netherlands',
       'NL02TEST0123456789',
       10080,
       'ACTIVE',
       CAST('00000000-0000-0000-0000-000000000002' AS UUID)
    WHERE NOT EXISTS (
        SELECT 1 FROM users
        WHERE user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002'
           OR (email = 'superadmintestcompany2@example.com' AND company_id = CAST('00000000-0000-0000-0000-000000000002' AS UUID))
    );

INSERT INTO users (user_id, email, preferred_name, first_names, middle_name_prefix, last_name, gender, date_of_birth, mobile_number, position, worked_for_us_before, street, house_number, house_number_suffix, postal_code, city, country, iban, payslip_frequency_minutes, status, company_id)
SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002',
       'anna.testcompany2@example.com',
       'Anna',
       'Anna',
       NULL,
       'Tester',
       'FEMALE',
       '1993-06-10',
       '0612340002',
       'BAR',
       false,
       'Kade',
       '12',
       'A',
       '3000 BB',
       'Rotterdam',
       'Netherlands',
       'NL12TEST0123456789',
       10080,
       'ACTIVE',
       CAST('00000000-0000-0000-0000-000000000002' AS UUID)
    WHERE NOT EXISTS (
        SELECT 1 FROM users
        WHERE user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0002'
           OR (email = 'anna.testcompany2@example.com' AND company_id = CAST('00000000-0000-0000-0000-000000000002' AS UUID))
    );

INSERT INTO users (user_id, email, preferred_name, first_names, middle_name_prefix, last_name, gender, date_of_birth, mobile_number, position, worked_for_us_before, street, house_number, house_number_suffix, postal_code, city, country, iban, payslip_frequency_minutes, status, company_id)
SELECT 'cccccccc-cccc-cccc-cccc-cccccccc0002',
       'ben.testcompany2@example.com',
       'Ben',
       'Ben',
       NULL,
       'Tester',
       'MALE',
       '1990-11-05',
       '0612340003',
       'RUNNER',
       false,
       'Havenweg',
       '8',
       NULL,
       '3000 CC',
       'Rotterdam',
       'Netherlands',
       'NL34TEST0123456789',
       10080,
       'ACTIVE',
       CAST('00000000-0000-0000-0000-000000000002' AS UUID)
    WHERE NOT EXISTS (
        SELECT 1 FROM users
        WHERE user_id = 'cccccccc-cccc-cccc-cccc-cccccccc0002'
           OR (email = 'ben.testcompany2@example.com' AND company_id = CAST('00000000-0000-0000-0000-000000000002' AS UUID))
    );

INSERT INTO leave_requests (request_id, user_id, type, start_date, end_date, hours, reason, status, created_at, updated_at)
SELECT 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
       '11111111-1111-1111-1111-111111111111',
       'VACATION',
       '2025-07-15',
       '2025-07-19',
       40,
       'summer holiday',
       'APPROVED',
       '2025-06-01 09:00:00+00',
       '2025-06-05 10:00:00+00'
    WHERE NOT EXISTS (SELECT 1 FROM leave_requests WHERE request_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001');

INSERT INTO leave_requests (request_id, user_id, type, start_date, end_date, hours, reason, status, created_at, updated_at)
SELECT 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0001',
       '22222222-2222-2222-2222-222222222222',
       'SICK',
       '2025-02-10',
       '2025-02-11',
       16,
       'flu',
       'PENDING',
       '2025-02-10 08:30:00+00',
       '2025-02-10 08:30:00+00'
    WHERE NOT EXISTS (SELECT 1 FROM leave_requests WHERE request_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbb0001');

INSERT INTO leave_requests (request_id, user_id, type, start_date, end_date, hours, reason, status, created_at, updated_at)
SELECT '5398c965-d0b1-48f7-8ca2-b54d015c4560',
       'b825a6bd-50d3-47e0-890d-78bfc59911b7',
       'VACATION',
       '2026-02-10',
       '2026-02-12',
       24,
       'winter break',
       'PENDING',
       '2026-01-15 10:00:00+00',
       '2026-01-15 10:00:00+00'
    WHERE NOT EXISTS (SELECT 1 FROM leave_requests WHERE request_id = '5398c965-d0b1-48f7-8ca2-b54d015c4560');
