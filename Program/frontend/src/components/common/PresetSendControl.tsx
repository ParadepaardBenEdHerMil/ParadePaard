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

import "../../stylesheets/PresetSendControl.css";

type PresetSendControlProps = {
    /** Which preset group to offer (SHIFTS on a shift, PROJECTS on a project, USERS on an account). */
    group: "SHIFTS" | "PROJECTS" | "USERS";
    /** Resolved recipient user ids — e.g. everyone assigned to the shift/project, or the one account. */
    recipientUserIds: string[];
    /** Human phrase for the confirm + result copy, e.g. "everyone in this shift" or "this user". */
    recipientLabel: string;
    className?: string;
};

type PreviewTarget = {
    fileName?: string | null;
    contentType?: string | null;
    load: () => Promise<Blob>;
    onDownload?: () => void;
};

/**
 * A compact "pick a preset and send it" control. Opens a preview modal that renders the actual email
 * — subject, from/to, body and clickable attachments — before sending one message per recipient.
 * Application/onboarding presets are intentionally not offered here: those are sent as part of a
 * review decision so reject and request-changes can never be crossed.
 */
export default function PresetSendControl({
    group,
    recipientUserIds,
    recipientLabel,
    className,
}: PresetSendControlProps) {
    const [presets, setPresets] = useState<EmailPresetResponseDTO[]>([]);
    const [selectedId, setSelectedId] = useState("");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<PreviewTarget | null>(null);
    const [previewDownloading, setPreviewDownloading] = useState(false);

    useEffect(() => {
        let cancelled = false;
        UserServices.getEmailPresets()
            .then((all) => {
                if (!cancelled) setPresets(all.filter((preset) => preset.groupType === group));
            })
            .catch(() => {
                if (!cancelled) setPresets([]);
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

    const openConfirm = () => {
        if (!selectedPreset || uniqueRecipients.length === 0) return;
        setError(null);
        setResult(null);
        setConfirmOpen(true);
    };

    const confirmSend = async () => {
        if (!selectedPreset || uniqueRecipients.length === 0) return;
        try {
            setSending(true);
            setError(null);
            const response = await UserServices.sendEmailPreset(selectedPreset.id, uniqueRecipients);
            setResult(
                `Sent to ${response.sent} of ${response.requested} recipient${response.requested === 1 ? "" : "s"}.`
            );
            setSelectedId("");
            setConfirmOpen(false);
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
            const link = document.createElement("a");
            link.href = url;
            link.download = attachment.fileName;
            link.rel = "noopener";
            document.body.appendChild(link);
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

    if (presets.length === 0) {
        return null;
    }

    const attachments = selectedPreset?.attachments ?? [];

    return (
        <div className={`presetSendControl${className ? ` ${className}` : ""}`}>
            <div className="presetSendRow">
                <select
                    className="presetSendSelect"
                    value={selectedId}
                    onChange={(event) => {
                        setSelectedId(event.target.value);
                        setResult(null);
                        setError(null);
                    }}
                    aria-label="Choose an email preset"
                >
                    <option value="">Send a preset email…</option>
                    {presets.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                            {preset.name}
                        </option>
                    ))}
                </select>
                <button
                    type="button"
                    className="button buttonSecondary presetSendButton"
                    onClick={openConfirm}
                    disabled={!selectedPreset || uniqueRecipients.length === 0 || sending}
                >
                    Send…
                </button>
            </div>
            {result ? <div className="presetSendResult">{result}</div> : null}
            {error && !confirmOpen ? <div className="presetSendError">{error}</div> : null}

            {confirmOpen && selectedPreset ? (
                <Modal
                    open
                    onClose={() => {
                        if (!sending) setConfirmOpen(false);
                    }}
                    title="Send this email?"
                    hideDefaultFooter
                    maxHeight="88dvh"
                    footer={
                        <>
                            <button
                                type="button"
                                className="button buttonSecondary"
                                onClick={() => setConfirmOpen(false)}
                                disabled={sending}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="button"
                                onClick={() => void confirmSend()}
                                disabled={sending}
                            >
                                {sending ? "Sending…" : `Send to ${recipientCountLabel}`}
                            </button>
                        </>
                    }
                >
                    <div className="presetPreview">
                        <div className="presetPreviewMeta">
                            Sending <strong>{selectedPreset.name}</strong> to {recipientLabel} · {recipientCountLabel}
                        </div>
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
                        <p className="presetPreviewNote">
                            Placeholders like {"{{first_name}}"} and links are filled in for each recipient when
                            sent. Click an attachment to preview it.
                        </p>
                        {error ? <div className="presetSendError">{error}</div> : null}
                    </div>
                </Modal>
            ) : null}

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
        </div>
    );
}
