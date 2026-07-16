-- V10: documents attached to an email preset.
--
-- Files uploaded onto a preset are sent as attachments on every email from that preset. Bytes are
-- stored in-row (like applicant CVs / profile pictures elsewhere in this service). ON DELETE CASCADE
-- so removing a preset drops its attachments. Column types mirror the EmailPresetAttachment JPA
-- entity so the service keeps booting with ddl-auto=validate.

CREATE TABLE public.email_preset_attachments (
    id uuid NOT NULL,
    preset_id uuid NOT NULL,
    file_name varchar(255) NOT NULL,
    content_type varchar(255),
    size_bytes bigint NOT NULL,
    bytes bytea NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    CONSTRAINT email_preset_attachments_pkey PRIMARY KEY (id),
    CONSTRAINT email_preset_attachments_preset_fk FOREIGN KEY (preset_id)
        REFERENCES public.email_presets (id) ON DELETE CASCADE
);

CREATE INDEX idx_email_preset_attachments_preset ON public.email_preset_attachments (preset_id);
