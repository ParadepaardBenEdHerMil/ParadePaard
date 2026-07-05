-- V1: baseline schema for user-service.
--
-- B6 (versioned migrations): this is the exact schema Hibernate generates for the
-- current JPA entities, captured via pg_dump. It matches the entity mappings 1:1,
-- so the service runs with spring.jpa.hibernate.ddl-auto=validate. If entities
-- change, add a new versioned migration (Vn__*.sql); do not hand-edit this file to
-- diverge from the entities or Hibernate schema validation will fail on boot.

--
-- Name: audit_log_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log_entries (
    id uuid NOT NULL,
    action character varying(255) NOT NULL,
    actor_display_name character varying(255) NOT NULL,
    actor_user_id uuid,
    category character varying(255) NOT NULL,
    company_id uuid NOT NULL,
    entity_id character varying(255),
    entity_type character varying(255) NOT NULL,
    message_parts_json text NOT NULL,
    occurred_at timestamp(6) with time zone NOT NULL,
    summary text NOT NULL
);


--
-- Name: cao_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cao_templates (
    cao_id uuid NOT NULL,
    company_id uuid NOT NULL,
    effective_from date,
    effective_until date,
    name character varying(255) NOT NULL,
    sector character varying(255),
    variables_json text
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid NOT NULL,
    city character varying(255),
    logo_bytes bytea,
    logo_content_type character varying(255),
    name character varying(255) NOT NULL,
    payout_frequency_minutes integer NOT NULL,
    payroll_tax_templates_json oid,
    postal_code character varying(255),
    street character varying(255),
    timesheet_logging_mode character varying(32) DEFAULT 'ADMIN_FINALIZE'::character varying NOT NULL,
    travel_claim_mode character varying(32) DEFAULT 'REQUIRES_APPROVAL'::character varying NOT NULL
);


--
-- Name: horeca_job_preset_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horeca_job_preset_configs (
    id uuid NOT NULL,
    active boolean NOT NULL,
    admin_notes character varying(2000),
    default_contract_type character varying(255) NOT NULL,
    default_hourly_wage numeric(19,2) NOT NULL,
    default_hours_per_week numeric(8,2),
    default_monthly_wage numeric(19,2),
    default_payroll_period character varying(255) NOT NULL,
    document_name character varying(255),
    document_url character varying(1000),
    function_group character varying(255) NOT NULL,
    holiday_allowance_mode character varying(255) NOT NULL,
    job_function character varying(1000) NOT NULL,
    job_title character varying(255) NOT NULL,
    page_reference character varying(255),
    pension_applicable boolean NOT NULL,
    preset_key character varying(255) NOT NULL,
    preset_name character varying(255) NOT NULL,
    rule_version_id uuid NOT NULL,
    sort_order integer NOT NULL,
    source_note character varying(2000),
    vacation_build_up_applicable boolean NOT NULL
);


--
-- Name: horeca_rule_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horeca_rule_items (
    id uuid NOT NULL,
    age_group character varying(64),
    calculation_rule character varying(1000),
    document_name character varying(255),
    document_url character varying(1000),
    function_group character varying(64),
    item_key character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    page_reference character varying(255),
    rule_version_id uuid NOT NULL,
    section_key character varying(255) NOT NULL,
    sort_order integer NOT NULL,
    source_note character varying(2000),
    unit character varying(255),
    used_in_contract boolean NOT NULL,
    used_in_payroll boolean NOT NULL,
    value_boolean boolean,
    value_number numeric(19,4),
    value_text character varying(2000),
    value_type character varying(255) NOT NULL,
    CONSTRAINT horeca_rule_items_section_key_check CHECK (((section_key)::text = ANY ((ARRAY['WAGE_RULES'::character varying, 'TAX_AND_PAYROLL_RULES'::character varying, 'PENSION_RULES'::character varying, 'HOLIDAY_AND_TRAVEL_RULES'::character varying])::text[]))),
    CONSTRAINT horeca_rule_items_value_type_check CHECK (((value_type)::text = ANY ((ARRAY['TEXT'::character varying, 'NUMBER'::character varying, 'BOOLEAN'::character varying])::text[])))
);


--
-- Name: horeca_rule_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.horeca_rule_versions (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    created_by_user_id uuid,
    effective_from date,
    effective_to date,
    published_at timestamp(6) with time zone,
    published_by_user_id uuid,
    reason character varying(2000),
    source_summary character varying(2000),
    status character varying(255) NOT NULL,
    version_label character varying(255) NOT NULL,
    CONSTRAINT horeca_rule_versions_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'PUBLISHED'::character varying, 'SUPERSEDED'::character varying])::text[])))
);


--
-- Name: job_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.job_applications (
    application_id uuid NOT NULL,
    accepted_user_id uuid,
    available_from date,
    city character varying(255),
    contact_consent boolean NOT NULL,
    contract_preference character varying(255),
    country character varying(255),
    cv_bytes bytea,
    cv_content_type character varying(255),
    cv_file_name character varying(255),
    date_of_birth date NOT NULL,
    decision_email_sent boolean,
    email character varying(255) NOT NULL,
    first_names character varying(255) NOT NULL,
    gender character varying(255),
    information_accurate boolean NOT NULL,
    last_name character varying(255) NOT NULL,
    middle_name_prefix character varying(255),
    nationality character varying(255),
    note character varying(2000),
    phone_number character varying(255) NOT NULL,
    preferred_name character varying(255),
    profile_picture_bytes bytea,
    profile_picture_content_type character varying(255),
    profile_picture_file_name character varying(255),
    review_note character varying(4000),
    reviewed_at timestamp(6) with time zone,
    reviewed_by_user_id character varying(255),
    role_interest character varying(255),
    status character varying(255) NOT NULL,
    submitted_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    worked_for_us_before boolean NOT NULL,
    CONSTRAINT job_applications_status_check CHECK (((status)::text = ANY ((ARRAY['APPLICATION_SUBMITTED'::character varying, 'APPLICATION_DENIED'::character varying, 'APPLICATION_ACCEPTED'::character varying])::text[])))
);


--
-- Name: leave_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_balances (
    id uuid NOT NULL,
    company_id uuid,
    created_at timestamp(6) with time zone NOT NULL,
    entitled_hours integer NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    used_hours integer NOT NULL,
    user_id uuid NOT NULL,
    balance_year integer NOT NULL
);


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_requests (
    request_id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    end_date date NOT NULL,
    hours integer NOT NULL,
    reason character varying(1000),
    start_date date NOT NULL,
    status character varying(32) NOT NULL,
    type character varying(32) NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    user_id uuid NOT NULL,
    CONSTRAINT leave_requests_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying, 'CANCELED'::character varying])::text[]))),
    CONSTRAINT leave_requests_type_check CHECK (((type)::text = ANY ((ARRAY['VACATION'::character varying, 'SICK'::character varying, 'UNPAID'::character varying, 'PARENTAL'::character varying, 'OTHER'::character varying])::text[])))
);


--
-- Name: message_conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_conversations (
    conversation_id uuid NOT NULL,
    company_id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    last_message_at timestamp(6) with time zone,
    last_message_preview character varying(500),
    unread_by_admin_count integer NOT NULL,
    unread_by_user_count integer NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: message_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.message_entries (
    message_id uuid NOT NULL,
    body character varying(4000) NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    sender_type character varying(32) NOT NULL,
    sender_user_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    CONSTRAINT message_entries_sender_type_check CHECK (((sender_type)::text = ANY ((ARRAY['USER'::character varying, 'ADMIN'::character varying])::text[])))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id uuid NOT NULL,
    apply_loonheffingskorting boolean DEFAULT false NOT NULL,
    assigned_cao_id uuid,
    bank_account_holder_name character varying(255),
    bsn character varying(255),
    cao_variable_overrides_json text,
    city character varying(255),
    company_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid NOT NULL,
    country character varying(255),
    date_of_birth date,
    email character varying(255),
    emergency_contact_email character varying(255),
    emergency_contact_name character varying(255),
    emergency_contact_phone character varying(255),
    emergency_contact_relationship character varying(255),
    first_names character varying(255),
    gender character varying(255),
    house_number character varying(255),
    house_number_suffix character varying(255),
    iban character varying(255),
    id_document_back_image bytea,
    id_document_back_image_content_type character varying(255),
    id_document_image bytea,
    id_document_image_content_type character varying(255),
    id_document_number character varying(255),
    id_document_type character varying(255),
    id_expiration_date date,
    id_issue_date date,
    id_issuing_country character varying(255),
    last_name character varying(255),
    middle_name_prefix character varying(255),
    mobile_number character varying(255),
    nationality character varying(255),
    onboarding_review_checked_sections_json text,
    onboarding_review_contract_setup_json text,
    onboarding_review_decision character varying(255),
    onboarding_review_note character varying(2000),
    payroll_notes character varying(2000),
    payslip_frequency_minutes integer NOT NULL,
    pension_participant boolean DEFAULT false NOT NULL,
    "position" character varying(255),
    postal_code character varying(255),
    preferred_name character varying(255),
    profile_picture_bytes bytea,
    profile_picture_content_type character varying(255),
    registered_date date DEFAULT CURRENT_DATE NOT NULL,
    special_zvw_contribution boolean DEFAULT false NOT NULL,
    status character varying(255) DEFAULT 'PENDING_SETUP'::character varying NOT NULL,
    street character varying(255),
    work_history_columns_json text,
    worked_for_us_before boolean NOT NULL,
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING_SETUP'::character varying, 'PENDING_PROFILE_REVIEW'::character varying, 'CHANGES_REQUESTED'::character varying, 'PENDING_CONTRACT_SIGNATURE'::character varying, 'PENDING_CONTRACT_REVIEW'::character varying, 'ACTIVE'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: cao_templates cao_templates_company_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cao_templates
    ADD CONSTRAINT cao_templates_company_name_key UNIQUE (company_id, name);


--
-- Name: cao_templates cao_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cao_templates
    ADD CONSTRAINT cao_templates_pkey PRIMARY KEY (cao_id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: horeca_job_preset_configs horeca_job_preset_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horeca_job_preset_configs
    ADD CONSTRAINT horeca_job_preset_configs_pkey PRIMARY KEY (id);


--
-- Name: horeca_rule_items horeca_rule_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horeca_rule_items
    ADD CONSTRAINT horeca_rule_items_pkey PRIMARY KEY (id);


--
-- Name: horeca_rule_versions horeca_rule_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.horeca_rule_versions
    ADD CONSTRAINT horeca_rule_versions_pkey PRIMARY KEY (id);


--
-- Name: job_applications job_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.job_applications
    ADD CONSTRAINT job_applications_pkey PRIMARY KEY (application_id);


--
-- Name: leave_balances leave_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT leave_balances_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (request_id);


--
-- Name: message_conversations message_conversations_company_user_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_conversations
    ADD CONSTRAINT message_conversations_company_user_key UNIQUE (company_id, user_id);


--
-- Name: message_conversations message_conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_conversations
    ADD CONSTRAINT message_conversations_pkey PRIMARY KEY (conversation_id);


--
-- Name: message_entries message_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_entries
    ADD CONSTRAINT message_entries_pkey PRIMARY KEY (message_id);


--
-- Name: companies uk50ygfritln653mnfhxucoy8up; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT uk50ygfritln653mnfhxucoy8up UNIQUE (name);


--
-- Name: leave_balances uk_leave_balance_user_year; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_balances
    ADD CONSTRAINT uk_leave_balance_user_year UNIQUE (user_id, balance_year);


--
-- Name: users users_company_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_company_email_key UNIQUE (company_id, email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: message_entries fkbekkjpwfu7uwk90bjss0t1ltd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_entries
    ADD CONSTRAINT fkbekkjpwfu7uwk90bjss0t1ltd FOREIGN KEY (conversation_id) REFERENCES public.message_conversations(conversation_id);


--
-- Name: leave_requests fkh6s8bo5d59oy52b6nxfguf4yx; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT fkh6s8bo5d59oy52b6nxfguf4yx FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- Name: message_conversations fkoq34d85jrtodxfshb2t4wcc0b; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.message_conversations
    ADD CONSTRAINT fkoq34d85jrtodxfshb2t4wcc0b FOREIGN KEY (user_id) REFERENCES public.users(user_id);

