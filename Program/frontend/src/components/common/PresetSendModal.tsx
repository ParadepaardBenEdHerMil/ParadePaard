import { useEffect, useMemo, useState } from "react";
import Modal from "./Modal";
import FilePreviewModal from "./FilePreviewModal";
import { UserServices } from "../../services/user-service/UserServices";
import type {
    EmailPresetAttachmentDTO,
    EmailPresetResponseDTO,
} from "../../services/user-service/EmailPresets";
import { formatFileSize } from "../../utils/formatFileSize";
import { fileBadge } from "../../utils/fileBadge";

import "../../stylesheets/PresetSendModal.css";

type PresetSendModalProps = {
    /** Which preset group to offer (SHIFTS on a shift, PROJECTS on a project, USERS on an account). */
    group: "SHIFTS" | "PROJECTS" | "USERS";
    /** Resolved recipient user ids — e.g. everyone assigned to the shift/project, or the one account. */
    recipientUserIds: string[];
    /** Human phrase for the "To …" line, e.g. "everyone in this shift" or "this user". */
    recipientLabel: string;
    onClose: () => void;
};

type PreviewTarget = {
    fileName?: string | null;
    contentType?: string | null;
    load: () => Promise<Blob>;
    onDownload?: () => void;
};

/**
 * The "Mail" action of the page Tools menu: pick a preset for this section, preview the actual
 * email (subject, from/to, body and clickable attachments), then send one message per recipient.
 * Application/onboarding presets are intentionally not offered here — those go out through the
 * review decision so reject and request-changes can never be crossed.
 */
export default function PresetSendModal({
    group,
    recipientUserIds,
    recipientLabel,
    onClose,
}: PresetSendModalProps) {
    const [presets, setPresets] = useState<EmailPresetResponseDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState("");
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<PreviewTarget | null>(null);
    const [previewDownloading, setPreviewDownloading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        UserServices.getEmailPresets()
            .then((all) => {
                if (!cancelled) setPresets(all.filter((preset) => preset.groupType === group));
            })
            .catch(() => {
                if (!cancelled) setPresets([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [group]);

    const uniqueRecipients = useMemo(
        () => Array.from(new Set(recipientUserIds.filter(Boolean))),
        [recipientUserIds]
    );
    const selectedPreset = presets.find((preset) => preset.id === selectedId) ?? null;
    const recipientCountLabel = `${uniqueRecipients.length} recipient${uniqueRecipients.length === 1 ? "" : "s"}`;
    const attachments = selectedPreset?.attachments ?? [];

    const send = async () => {
        if (!selectedPreset || uniqueRecipients.length === 0) return;
        try {
            setSending(true);
            setError(null);
            const response = await UserServices.sendEmailPreset(selectedPreset.id, uniqueRecipients);
            setResult(
                `Sent to ${response.sent} of ${response.requested} recipient${response.requested === 1 ? "" : "s"}.`
            );
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to send the preset email.");
        } finally {
            setSending(false);
        }
    };

    const downloadAttachment = async (presetId: string, attachment: EmailPresetAttachmentDTO) => {
        try {
            setPreviewDownloading(true);
            const blob = await UserServices.getEmailPresetAttachmentBlob(presetId, attachment.id);
            const url = URL.createObjectURL(blob);
            const link = window.document.createElement("a");
            link.href = url;
            link.download = attachment.fileName;
            link.rel = "noopener";
            window.document.body.appendChild(link);
            link.click();
            link.remove();
            window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        } finally {
            setPreviewDownloading(false);
        }
    };

    const openAttachmentPreview = (presetId: string, attachment: EmailPresetAttachmentDTO) => {
        setPreview({
            fileName: attachment.fileName,
            contentType: attachment.contentType,
            load: () => UserServices.getEmailPresetAttachmentBlob(presetId, attachment.id),
            onDownload: () => void downloadAttachment(presetId, attachment),
        });
    };

    const footer = result ? (
        <button type="button" className="button" onClick={onClose}>
            Done
        </button>
    ) : (
        <>
            <button
                type="button"
                className="button buttonSecondary"
                onClick={onClose}
                disabled={sending}
            >
                Cancel
            </button>
            <button
                type="button"
                className="button"
                onClick={() => void send()}
                disabled={!selectedPreset || uniqueRecipients.length === 0 || sending}
            >
                {sending ? "Sending…" : `Send to ${recipientCountLabel}`}
            </button>
        </>
    );

    return (
        <>
            <Modal
                open
                onClose={() => {
                    if (!sending) onClose();
                }}
                title="Send an email"
                hideDefaultFooter
                maxHeight="88dvh"
                footer={footer}
            >
                {result ? (
                    <div className="presetSendDone">
                        <div className="presetSendDoneIcon" aria-hidden="true">✓</div>
                        <div className="presetSendDoneText">{result}</div>
                    </div>
                ) : loading ? (
                    <div className="presetSendState">Loading templates…</div>
                ) : presets.length === 0 ? (
                    <div className="presetSendState">
                        No email templates for this section yet. Create one under Email presets.
                    </div>
                ) : (
                    <div className="presetPreview">
                        <label className="presetSendPicker">
                            <span className="presetSendPickerLabel">Template</span>
                            <select
                                className="modal_input"
                                value={selectedId}
                                onChange={(event) => {
                                    setSelectedId(event.target.value);
                                    setError(null);
                                }}
                                aria-label="Choose an email template"
                            >
                                <option value="">Choose a template…</option>
                                {presets.map((preset) => (
                                    <option key={preset.id} value={preset.id}>
                                        {preset.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <div className="presetPreviewMeta">
                            To {recipientLabel} · {recipientCountLabel}
                        </div>
                        {selectedPreset ? (
                            <div className="presetPreviewEmail">
                                <div className="presetPreviewHeader">
                                    <h4 className="presetPreviewSubject">
                                        {selectedPreset.subject || "(no subject)"}
                                    </h4>
                                    <div className="presetPreviewAddrs">
                                        <div className="presetPreviewAddr">
                                            <span className="presetPreviewAddrLabel">From</span>
                                            <span>ParadePaard</span>
                                        </div>
                                        <div className="presetPreviewAddr">
                                            <span className="presetPreviewAddrLabel">To</span>
                                            <span>{recipientLabel} · {recipientCountLabel}</span>
                                        </div>
                                    </div>
                                </div>
                                <div
                                    className="presetPreviewBody"
                                    // Admin-authored preset HTML, rendered like an email client would.
                                    dangerouslySetInnerHTML={{ __html: selectedPreset.body }}
                                />
                                {attachments.length > 0 ? (
                                    <div className="presetPreviewAttachments">
                                        <div className="presetPreviewAttachmentsLabel">
                                            {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
                                        </div>
                                        <div className="presetPreviewChips">
                                            {attachments.map((attachment) => {
                                                const badge = fileBadge(attachment.fileName);
                                                return (
                                                    <button
                                                        type="button"
                                                        key={attachment.id}
                                                        className="presetPreviewChip"
                                                        title={`Preview ${attachment.fileName}`}
                                                        onClick={() =>
                                                            openAttachmentPreview(selectedPreset.id, attachment)
                                                        }
                                                    >
                                                        <span
                                                            className={`presetPreviewChipIcon presetPreviewChipIcon--${badge.kind}`}
                                                        >
                                                            {badge.label}
                                                        </span>
                                                        <span className="presetPreviewChipInfo">
                                                            <span className="presetPreviewChipName">
                                                                {attachment.fileName}
                                                            </span>
                                                            <span className="presetPreviewChipSize">
                                                                {formatFileSize(attachment.sizeBytes)}
                                                            </span>
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        ) : (
                            <div className="presetSendState presetSendState--muted">
                                Choose a template above to preview it.
                            </div>
                        )}
                        <p className="presetPreviewNote">
                            Placeholders like {"{{first_name}}"} and links are filled in for each recipient when
                            sent. Click an attachment to preview it.
                        </p>
                        {error ? <div className="presetSendError">{error}</div> : null}
                    </div>
                )}
            </Modal>

            {preview ? (
                <FilePreviewModal
                    open
                    onClose={() => setPreview(null)}
                    fileName={preview.fileName}
                    contentType={preview.contentType}
                    load={preview.load}
                    onDownload={preview.onDownload}
                    downloading={previewDownloading}
                />
            ) : null}
        </>
    );
}
