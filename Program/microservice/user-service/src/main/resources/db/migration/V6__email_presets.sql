-- V6: reusable email presets.
--
-- Admin-authored email templates, grouped by context (shift / project / user / application /
-- onboarding). The category column keeps reject and request-changes templates separate for the
-- APPLICATIONS and ONBOARDING groups. Column types mirror the EmailPreset JPA entity so the
-- service keeps booting with spring.jpa.hibernate.ddl-auto=validate.

CREATE TABLE public.email_presets (
    id uuid NOT NULL,
    company_id uuid NOT NULL,
    group_type varchar(32) NOT NULL,
    category varchar(32) NOT NULL DEFAULT 'GENERAL',
    name varchar(255) NOT NULL,
    subject varchar(255) NOT NULL,
    body varchar(8000) NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT email_presets_pkey PRIMARY KEY (id)
);

CREATE INDEX idx_email_presets_company ON public.email_presets (company_id);
