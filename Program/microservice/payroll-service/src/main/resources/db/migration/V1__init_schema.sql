-- V1: baseline schema for payroll-service.
--
-- B6 (versioned migrations): this is the exact schema Hibernate generates for the
-- current JPA entities, captured via pg_dump. It matches the entity mappings 1:1,
-- so the service runs with spring.jpa.hibernate.ddl-auto=validate. If entities
-- change, add a new versioned migration (Vn__*.sql); do not hand-edit this file to
-- diverge from the entities or Hibernate schema validation will fail on boot.

--
-- Name: jaaropgaven; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.jaaropgaven (
    id uuid NOT NULL,
    company_id uuid,
    finalized_at timestamp(6) with time zone,
    finalized_by_user_id uuid,
    fiscal_wage numeric(19,2),
    loonheffing numeric(19,2),
    pdf_data bytea,
    snapshot_json text,
    status character varying(20) NOT NULL,
    total_net numeric(19,2),
    user_id uuid NOT NULL,
    year integer NOT NULL,
    CONSTRAINT jaaropgaven_status_check CHECK (((status)::text = ANY ((ARRAY['PROVISIONAL'::character varying, 'FINAL'::character varying])::text[])))
);


--
-- Name: payslip_documents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payslip_documents (
    document_id uuid NOT NULL,
    content oid NOT NULL,
    content_type character varying(255) NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    file_name character varying(255) NOT NULL,
    payslip_id uuid NOT NULL,
    size_bytes bigint NOT NULL
);


--
-- Name: payslips; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payslips (
    payslip_id uuid NOT NULL,
    apply_loonheffingskorting boolean,
    arbeidskorting_applied numeric(19,2),
    available_to_user_at date,
    bsn character varying(9),
    city character varying(255),
    company_id uuid,
    contract_end_date date,
    contract_id uuid,
    contract_start_date date,
    contract_type character varying(255),
    country character varying(255),
    date_of_birth date,
    date_of_issue date NOT NULL,
    deduction_lines_json text,
    employee_zvw_withheld numeric(19,2),
    employer_insurance_premiums numeric(19,2),
    employer_zvw_levy numeric(19,2),
    error_description character varying(2000),
    fiscal_wage numeric(19,2),
    fiscal_year integer,
    function_name character varying(255),
    generated_at timestamp(6) with time zone,
    holiday_allowance_percentage numeric(5,2),
    hourly_wage numeric(19,2),
    house_number character varying(255),
    house_number_suffix character varying(255),
    leave_pay_amount numeric(19,2),
    wage_tax_withheld_test numeric(19,2),
    name character varying(255),
    pay_period_end date,
    pay_period_key character varying(120),
    pay_period_start date,
    payment_date date,
    payment_frequency character varying(255),
    postal_code character varying(255),
    start_date date,
    status character varying(40),
    street_name character varying(255),
    total_employee_deductions numeric(19,2),
    total_gross_amount numeric(19,2),
    total_hours_worked numeric(19,2),
    total_net_amount numeric(19,2),
    travel_expenses numeric(19,2),
    travel_kilometers numeric(19,2),
    user_id uuid NOT NULL,
    week_based_year integer,
    week_number integer,
    weekly_hours numeric(5,2),
    CONSTRAINT payslips_status_check CHECK (((status)::text = ANY ((ARRAY['NEEDS_ATTENTION'::character varying, 'DISPUTED'::character varying, 'PENDING_REVIEW'::character varying, 'PENDING_APPROVAL'::character varying, 'APPROVED'::character varying, 'RELEASED'::character varying])::text[])))
);


--
-- Name: shift_finance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_finance_records (
    id uuid NOT NULL,
    client_company_id uuid,
    client_name character varying(255),
    client_revenue numeric(19,2),
    company_id uuid,
    created_at timestamp(6) with time zone,
    employer_premiums numeric(19,2),
    employer_zvw numeric(19,2),
    function_name character varying(255),
    gross_wage numeric(19,2),
    holiday_allowance numeric(19,2),
    hourly_wage numeric(19,2),
    hours numeric(19,2),
    locked boolean NOT NULL,
    margin numeric(19,2),
    margin_percentage numeric(19,2),
    margin_status character varying(255),
    pay_period_key character varying(255),
    payslip_id uuid,
    project_id uuid,
    project_name character varying(255),
    rate_per_hour numeric(19,2),
    rate_source character varying(255),
    shift_date date,
    tag character varying(255),
    timesheet_id uuid NOT NULL,
    total_employer_cost numeric(19,2),
    updated_at timestamp(6) with time zone,
    user_id uuid
);


--
-- Name: jaaropgaven jaaropgaven_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jaaropgaven
    ADD CONSTRAINT jaaropgaven_pkey PRIMARY KEY (id);


--
-- Name: payslip_documents payslip_documents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslip_documents
    ADD CONSTRAINT payslip_documents_pkey PRIMARY KEY (document_id);


--
-- Name: payslips payslips_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payslips
    ADD CONSTRAINT payslips_pkey PRIMARY KEY (payslip_id);


--
-- Name: shift_finance_records shift_finance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_finance_records
    ADD CONSTRAINT shift_finance_records_pkey PRIMARY KEY (id);


--
-- Name: jaaropgaven uk_jaaropgaaf_company_user_year; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.jaaropgaven
    ADD CONSTRAINT uk_jaaropgaaf_company_user_year UNIQUE (company_id, user_id, year);


--
-- Name: shift_finance_records uk_shift_finance_timesheet; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_finance_records
    ADD CONSTRAINT uk_shift_finance_timesheet UNIQUE (timesheet_id);

