-- V1: baseline schema for timesheet-service.
--
-- B6 (versioned migrations): this is the exact schema Hibernate generates for the
-- current JPA entities, captured via pg_dump. It matches the entity mappings 1:1,
-- so the service runs with spring.jpa.hibernate.ddl-auto=validate. If entities
-- change, add a new versioned migration (Vn__*.sql); do not hand-edit this file to
-- diverge from the entities or Hibernate schema validation will fail on boot.

--
-- Name: timesheet_audit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timesheet_audit (
    id uuid NOT NULL,
    action character varying(255) NOT NULL,
    actor_user_id uuid,
    at timestamp(6) with time zone NOT NULL,
    from_status character varying(255),
    reason character varying(1000),
    timesheet_id uuid NOT NULL,
    to_status character varying(255),
    CONSTRAINT timesheet_audit_action_check CHECK (((action)::text = ANY ((ARRAY['CREATED'::character varying, 'UPDATED'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT timesheet_audit_from_status_check CHECK (((from_status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[]))),
    CONSTRAINT timesheet_audit_to_status_check CHECK (((to_status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: timesheets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.timesheets (
    timesheet_id uuid NOT NULL,
    break_minutes integer,
    company_id uuid,
    date_of_issue date NOT NULL,
    decided_at timestamp(6) with time zone,
    decided_by_user_id uuid,
    decision_reason character varying(1000),
    function character varying(255),
    hours_worked numeric(19,2),
    name character varying(255),
    project_name character varying(255),
    shift_date date,
    shift_end_time timestamp(6) without time zone,
    shift_name character varying(255),
    shift_start_time timestamp(6) without time zone,
    source_project_id uuid,
    source_schedule_entry_id uuid,
    source_shift_id uuid,
    status character varying(255),
    travel_expenses numeric(19,2),
    travel_kilometers numeric(19,2),
    travel_rate numeric(19,2),
    user_id uuid,
    week_based_year integer,
    week_number integer,
    CONSTRAINT timesheets_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'APPROVED'::character varying, 'REJECTED'::character varying])::text[])))
);


--
-- Name: timesheet_audit timesheet_audit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timesheet_audit
    ADD CONSTRAINT timesheet_audit_pkey PRIMARY KEY (id);


--
-- Name: timesheets timesheets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timesheets
    ADD CONSTRAINT timesheets_pkey PRIMARY KEY (timesheet_id);


--
-- Name: timesheets ukrd8llfg04tlle1a9q63t08h65; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.timesheets
    ADD CONSTRAINT ukrd8llfg04tlle1a9q63t08h65 UNIQUE (source_schedule_entry_id);

