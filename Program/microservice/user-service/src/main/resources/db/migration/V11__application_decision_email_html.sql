-- V11: store the applicant decision email as rich HTML.
--
-- Reject / request-changes emails now come from HTML presets, so the remembered copy (used for
-- resend) can exceed the old varchar(8000). Widen to text to match the JobApplication field
-- (columnDefinition = "text"); the service keeps booting with ddl-auto=validate.

ALTER TABLE public.job_applications
    ALTER COLUMN decision_email_body TYPE text;
