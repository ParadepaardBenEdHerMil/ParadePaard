-- V9: store preset email bodies as rich HTML.
--
-- Widen email_presets.body from varchar(8000) to text: bodies now hold formatted HTML
-- (bold/size/colour/lists/links), which easily exceeds 8000 chars. Matches the EmailPreset
-- JPA field (columnDefinition = "text") so the service keeps booting with ddl-auto=validate.

ALTER TABLE public.email_presets
    ALTER COLUMN body TYPE text;
