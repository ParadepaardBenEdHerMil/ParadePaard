-- V8: allow the APPLICATION_CHANGES_REQUESTED status on job_applications.
--
-- V1's status CHECK constraint only permitted submitted / denied / accepted. The request-changes
-- decision persists APPLICATION_CHANGES_REQUESTED (see the ApplicationStatus enum), which the old
-- constraint rejected at insert/update time. Drop and recreate it with the new value so the
-- request-changes flow works; the enum is stored as a string so no column change is needed.

ALTER TABLE public.job_applications
    DROP CONSTRAINT IF EXISTS job_applications_status_check;

ALTER TABLE public.job_applications
    ADD CONSTRAINT job_applications_status_check
        CHECK (((status)::text = ANY ((ARRAY[
            'APPLICATION_SUBMITTED'::character varying,
            'APPLICATION_CHANGES_REQUESTED'::character varying,
            'APPLICATION_DENIED'::character varying,
            'APPLICATION_ACCEPTED'::character varying
        ])::text[])));
