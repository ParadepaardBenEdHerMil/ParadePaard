import { useMemo, useState } from "react";
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
    /** The template chosen from the Tools → Mail submenu. */
    preset: EmailPresetResponseDTO;
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
 * The "Mail" action of the page Tools menu. The template is picked from the menu's submenu; this
 * modal previews the actual email (subject, from/to, body and clickable attachments) and sends one
 * message per recipient. Application/onboarding presets are intentionally not offered here — those
 * go out through the review decision so reject and request-changes can never be crossed.
 */
export default function PresetSendModal({
    preset,
    recipientUserIds,
    recipientLabel,
    onClose,
}: PresetSendModalProps) {
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<PreviewTarget | null>(null);
    const [previewDownloading, setPreviewDownloading] = useState(false);

    const uniqueRecipients = useMemo(
        () => Array.from(new Set(recipientUserIds.filter(Boolean))),
        [recipientUserIds]
    );
    const recipientCountLabel = `${uniqueRecipients.length} recipient${uniqueRecipients.length === 1 ? "" : "s"}`;
    const attachments = preset.attachments ?? [];

    const send = async () => {
        if (uniqueRecipients.length === 0) return;
        try {
            setSending(true);
            setError(null);
            const response = await UserServices.sendEmailPreset(preset.id, uniqueRecipients);
            setResult(
                `Sent to ${response.sent} of ${response.requested} recipient${response.requested === 1 ? "" : "s"}.`
            );
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to send the preset email.");
        } finally {
            setSending(false);
        }
    };

    const downloadAttachment = async (attachment: EmailPresetAttachmentDTO) => {
        try {
            setPreviewDownloading(true);
            const blob = await UserServices.getEmailPresetAttachmentBlob(preset.id, attachment.id);
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

    const openAttachmentPreview = (attachment: EmailPresetAttachmentDTO) => {
        setPreview({
            fileName: attachment.fileName,
            contentType: attachment.contentType,
            load: () => UserServices.getEmailPresetAttachmentBlob(preset.id, attachment.id),
            onDownload: () => void downloadAttachment(attachment),
        });
    };

    const footer = result ? (
        <button type="button" className="button" onClick={onClose}>
            Done
        </button>
    ) : (
        <>
            <button type="button" className="button buttonSecondary" onClick={onClose} disabled={sending}>
                Cancel
            </button>
            <button
                type="button"
                className="button"
                onClick={() => void send()}
                disabled={uniqueRecipients.length === 0 || sending}
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
                maxHeight={760}
                footer={footer}
            >
                {result ? (
                    <div className="presetSendDone">
                        <div className="presetSendDoneIcon" aria-hidden="true">✓</div>
                        <div className="presetSendDoneText">{result}</div>
                    </div>
                ) : (
                    <div className="presetPreview">
                        <div className="presetPreviewMeta">
                            <strong>{preset.name}</strong> · to {recipientLabel} · {recipientCountLabel}
                        </div>
                        <div className="presetPreviewEmail">
                            <div className="presetPreviewHeader">
                                <h4 className="presetPreviewSubject">{preset.subject || "(no subject)"}</h4>
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
                                dangerouslySetInnerHTML={{ __html: preset.body }}
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
                                                    onClick={() => openAttachmentPreview(attachment)}
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
