-- V3: add a triage status to feedback_entries.
--
-- Matches the FeedbackEntry.status JPA field (EnumType.STRING, length 16) so the
-- service keeps booting with spring.jpa.hibernate.ddl-auto=validate. Existing rows
-- default to PENDING; anyone can later flip an entry to FINISHED.

ALTER TABLE public.feedback_entries
    ADD COLUMN status character varying(16) NOT NULL DEFAULT 'PENDING';

ALTER TABLE public.feedback_entries
    ADD CONSTRAINT feedback_entries_status_check
        CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'FINISHED'::character varying])::text[])));
