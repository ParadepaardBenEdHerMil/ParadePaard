-- V7: remember the applicant-facing decision email so it can be resent.
--
-- When an application is rejected or sent back for changes, the resolved subject/body (from the
-- chosen preset, or the default template) is stored here so a later "resend" replays exactly what
-- was sent instead of falling back to a generic message. Nullable + varchar to match the
-- JobApplication JPA fields, so the service keeps booting with ddl-auto=validate. Existing rows
-- (and accepted applications, whose email is the auth onboarding mail) stay null.

ALTER TABLE public.job_applications
    ADD COLUMN decision_email_subject varchar(255);

ALTER TABLE public.job_applications
    ADD COLUMN decision_email_body varchar(8000);
