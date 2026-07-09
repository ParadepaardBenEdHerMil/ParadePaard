-- V2: feedback_entries for the navbar feedback widget.
--
-- Matches the FeedbackEntry JPA entity 1:1 so the service keeps booting with
-- spring.jpa.hibernate.ddl-auto=validate. Feedback is company-wide readable and has
-- no conversation grouping; author_name is a snapshot of the author's display name at
-- write time so the read tab never fans out to the users table.

--
-- Name: feedback_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feedback_entries (
    feedback_id uuid NOT NULL,
    author_user_id uuid NOT NULL,
    author_name character varying(255) NOT NULL,
    category character varying(32) NOT NULL,
    body character varying(4000) NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone,
    CONSTRAINT feedback_entries_category_check CHECK (((category)::text = ANY ((ARRAY['FEATURE'::character varying, 'BUG'::character varying, 'CLEANUP'::character varying])::text[])))
);


--
-- Name: feedback_entries feedback_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feedback_entries
    ADD CONSTRAINT feedback_entries_pkey PRIMARY KEY (feedback_id);


--
-- Name: idx_feedback_entries_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_feedback_entries_created_at ON public.feedback_entries USING btree (created_at DESC);
