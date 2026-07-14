-- V4: add per-field onboarding revision flags.
--
-- Mirrors the existing onboarding_review_checked_sections_json column and the
-- User.onboardingReviewFieldFlagsJson JPA field (columnDefinition = "TEXT"), so the
-- service keeps booting with spring.jpa.hibernate.ddl-auto=validate. Holds a JSON map of
-- fieldKey -> admin explanation; the employee sees these inline when the onboarding form
-- reopens after a "request changes" decision.

ALTER TABLE public.users
    ADD COLUMN onboarding_review_field_flags_json text;
