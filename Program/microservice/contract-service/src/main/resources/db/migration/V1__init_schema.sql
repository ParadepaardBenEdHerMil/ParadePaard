-- V1: baseline schema for contract-service.
--
-- B6 (versioned migrations): this is the exact schema Hibernate generates for the
-- current JPA entities, captured via pg_dump. It matches the entity mappings 1:1,
-- so the service runs with spring.jpa.hibernate.ddl-auto=validate. If entities
-- change, add a new versioned migration (Vn__*.sql); do not hand-edit this file to
-- diverge from the entities or Hibernate schema validation will fail on boot.

--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    contract_id uuid NOT NULL,
    agreement_checkbox_text character varying(255),
    apply_loonheffingskorting boolean,
    browser_user_agent character varying(1000),
    collective_agreement character varying(255),
    confidentiality_clause character varying(1000),
    contract_type character varying(40) NOT NULL,
    contract_version character varying(100),
    derived_from_rule_version_id uuid,
    document_hash character varying(128),
    drawn_signature_image text,
    employee_signed_at timestamp(6) with time zone,
    employer_agreement_checkbox_text character varying(255),
    employer_browser_user_agent character varying(1000),
    employer_contract_version character varying(100),
    employer_document_hash character varying(128),
    employer_drawn_signature_image text,
    employer_ip_address character varying(100),
    employer_signed_user_id uuid,
    employer_typed_signature_name character varying(255),
    end_date date,
    finalized_at timestamp(6) with time zone,
    function_id uuid,
    function_name character varying(255),
    gross_hourly_wage numeric(19,2) NOT NULL,
    holiday_allowance_percentage numeric(5,2),
    ip_address character varying(100),
    leave_entitlement_days integer,
    notice_period character varying(255),
    payment_frequency character varying(40) NOT NULL,
    pdf_data bytea,
    pension_applicable boolean,
    pension_employee_percentage numeric(5,2),
    pension_scheme character varying(255),
    probation_period character varying(255),
    rejected_at timestamp(6) with time zone,
    replaces_contract_id uuid,
    review_comment character varying(2000),
    sent_to_employee_at timestamp(6) with time zone,
    sickness_policy character varying(1000),
    signed_user_id uuid,
    special_zvw_contribution boolean,
    start_date date NOT NULL,
    status character varying(20) NOT NULL,
    travel_allowance boolean NOT NULL,
    typed_signature_name character varying(255),
    user_id uuid NOT NULL,
    weekly_hours numeric(5,2),
    work_location character varying(255),
    zvw_employee_percentage numeric(5,2),
    CONSTRAINT contracts_contract_type_check CHECK (((contract_type)::text = ANY ((ARRAY['FIXED_HOURS'::character varying, 'ON_CALL_RUNNER'::character varying, 'ON_CALL_BAR'::character varying])::text[]))),
    CONSTRAINT contracts_payment_frequency_check CHECK (((payment_frequency)::text = ANY ((ARRAY['DAILY'::character varying, 'WEEKLY'::character varying, 'BIWEEKLY'::character varying, 'FOUR_WEEKLY'::character varying, 'MONTHLY'::character varying, 'EVERY_5_MINUTES'::character varying, 'EVERY_10_MINUTES'::character varying])::text[]))),
    CONSTRAINT contracts_status_check CHECK (((status)::text = ANY ((ARRAY['DRAFT'::character varying, 'SENT_TO_EMPLOYEE'::character varying, 'EMPLOYEE_SIGNED'::character varying, 'FINALIZED'::character varying, 'REJECTED'::character varying, 'EXPIRED'::character varying, 'SIGNED'::character varying])::text[])))
);


--
-- Name: functions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.functions (
    id uuid NOT NULL,
    active boolean,
    department character varying(255),
    name character varying(255) NOT NULL,
    hourly_wage numeric(19,2) NOT NULL
);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (contract_id);


--
-- Name: functions functions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.functions
    ADD CONSTRAINT functions_pkey PRIMARY KEY (id);

