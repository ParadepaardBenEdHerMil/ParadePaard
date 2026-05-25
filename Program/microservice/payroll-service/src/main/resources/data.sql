-- keep seed scripts compatible with existing databases
ALTER TABLE IF EXISTS payslips ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'RELEASED';
ALTER TABLE IF EXISTS payslips ADD COLUMN IF NOT EXISTS available_to_user_at DATE;
ALTER TABLE IF EXISTS payslips ADD COLUMN IF NOT EXISTS generated_at TIMESTAMP;
ALTER TABLE IF EXISTS payslips ADD COLUMN IF NOT EXISTS error_description VARCHAR(2000);
ALTER TABLE IF EXISTS payslips ADD COLUMN IF NOT EXISTS total_employee_deductions NUMERIC(19,2);
ALTER TABLE IF EXISTS payslips ADD COLUMN IF NOT EXISTS deduction_lines_json TEXT;

DELETE FROM payslips;
