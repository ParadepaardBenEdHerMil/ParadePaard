CREATE TABLE IF NOT EXISTS client_function_billing_rates (
    client_function_billing_rate_id UUID NOT NULL,
    company_id UUID NOT NULL,
    client_company_id UUID NOT NULL,
    function_name VARCHAR(255) NOT NULL,
    rate_per_hour NUMERIC(19, 2) NOT NULL,
    effective_from TIMESTAMP NOT NULL,
    effective_to TIMESTAMP,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    notes VARCHAR(2000),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    created_by_user_id UUID,
    updated_by_user_id UUID,
    CONSTRAINT pk_client_function_billing_rates PRIMARY KEY (client_function_billing_rate_id)
);

CREATE INDEX IF NOT EXISTS idx_client_function_billing_rate_client
    ON client_function_billing_rates (company_id, client_company_id);
CREATE INDEX IF NOT EXISTS idx_client_function_billing_rate_active
    ON client_function_billing_rates (company_id, client_company_id, active);

CREATE TABLE IF NOT EXISTS project_function_billing_rates (
    project_function_billing_rate_id UUID NOT NULL,
    company_id UUID NOT NULL,
    client_company_id UUID NOT NULL,
    project_id UUID NOT NULL,
    function_name VARCHAR(255) NOT NULL,
    rate_per_hour NUMERIC(19, 2) NOT NULL,
    source_client_function_billing_rate_id UUID,
    copied_at TIMESTAMP NOT NULL,
    notes VARCHAR(2000),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    created_by_user_id UUID,
    updated_by_user_id UUID,
    CONSTRAINT pk_project_function_billing_rates PRIMARY KEY (project_function_billing_rate_id)
);

CREATE INDEX IF NOT EXISTS idx_project_function_billing_rate_project
    ON project_function_billing_rates (company_id, project_id);
CREATE INDEX IF NOT EXISTS idx_project_function_billing_rate_client
    ON project_function_billing_rates (company_id, client_company_id);

CREATE TABLE IF NOT EXISTS employee_client_function_billing_rates (
    employee_client_function_billing_rate_id UUID NOT NULL,
    company_id UUID NOT NULL,
    client_company_id UUID NOT NULL,
    user_id UUID NOT NULL,
    function_name VARCHAR(255) NOT NULL,
    rate_per_hour NUMERIC(19, 2) NOT NULL,
    effective_from TIMESTAMP NOT NULL,
    effective_to TIMESTAMP,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    notes VARCHAR(2000),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    created_by_user_id UUID,
    updated_by_user_id UUID,
    CONSTRAINT pk_employee_client_function_billing_rates PRIMARY KEY (employee_client_function_billing_rate_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_client_function_rate_client
    ON employee_client_function_billing_rates (company_id, client_company_id);
CREATE INDEX IF NOT EXISTS idx_employee_client_function_rate_user
    ON employee_client_function_billing_rates (company_id, user_id);

CREATE TABLE IF NOT EXISTS employee_project_function_billing_rates (
    employee_project_function_billing_rate_id UUID NOT NULL,
    company_id UUID NOT NULL,
    client_company_id UUID NOT NULL,
    project_id UUID NOT NULL,
    user_id UUID NOT NULL,
    function_name VARCHAR(255) NOT NULL,
    rate_per_hour NUMERIC(19, 2) NOT NULL,
    effective_from TIMESTAMP NOT NULL,
    effective_to TIMESTAMP,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    notes VARCHAR(2000),
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    created_by_user_id UUID,
    updated_by_user_id UUID,
    CONSTRAINT pk_employee_project_function_billing_rates PRIMARY KEY (employee_project_function_billing_rate_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_project_function_rate_project
    ON employee_project_function_billing_rates (company_id, project_id);
CREATE INDEX IF NOT EXISTS idx_employee_project_function_rate_user
    ON employee_project_function_billing_rates (company_id, user_id);
