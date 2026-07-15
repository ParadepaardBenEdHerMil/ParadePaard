-- V5: reapplications support.
--
-- Two flags, both with NOT NULL + defaults so existing rows validate cleanly under
-- spring.jpa.hibernate.ddl-auto=validate and the matching JPA fields (Company.allowReapplications,
-- JobApplication.reapplicationBlocked).
--
--  * companies.allow_reapplications  - company-wide switch: when false, an email whose prior
--    application was rejected / sent back can no longer submit a new application.
--  * job_applications.reapplication_blocked - per-applicant override set from the application
--    detail page, so a specific person can be barred from reapplying even when the company allows it.

ALTER TABLE public.companies
    ADD COLUMN allow_reapplications boolean NOT NULL DEFAULT true;

ALTER TABLE public.job_applications
    ADD COLUMN reapplication_blocked boolean NOT NULL DEFAULT false;
