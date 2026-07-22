import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import FilePreviewModal from "../components/common/FilePreviewModal";
import RichTextEditor from "../components/common/RichTextEditor";
import { useAuth } from "../context/AuthContext";
import { UserServices } from "../services/user-service/UserServices";
import type {
    EmailPresetAttachmentDTO,
    EmailPresetResponseDTO,
    EmailPresetSaveDTO,
} from "../services/user-service/EmailPresets";
import { formatFileSize } from "../utils/formatFileSize";
import { fileBadge } from "../utils/fileBadge";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminEmailPresets.css";

const GROUP_OPTIONS = [
    { value: "SHIFTS", label: "Shifts" },
    { value: "PROJECTS", label: "Projects" },
    { value: "USERS", label: "Users" },
    { value: "APPLICATIONS", label: "Applications" },
    { value: "ONBOARDING", label: "Onboarding" },
] as const;

const CATEGORY_OPTIONS = [
    { value: "REJECT", label: "Reject" },
    { value: "REQUEST_CHANGES", label: "Request changes" },
    { value: "ACCEPT", label: "Accept" },
] as const;

// Groups whose presets must be classified by decision so the flows can never cross.
const SPLIT_GROUPS = new Set(["APPLICATIONS", "ONBOARDING"]);

// ACCEPT only applies to APPLICATIONS — onboarding review has no accept step. Every split group
// still offers reject and request-changes.
function categoryOptionsForGroup(group: string) {
    return CATEGORY_OPTIONS.filter((option) => option.value !== "ACCEPT" || group === "APPLICATIONS");
}

const MAX_ATTACHMENTS = 6;
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

type PreviewTarget = {
    fileName?: string | null;
    contentType?: string | null;
    load: () => Promise<Blob>;
    onDownload?: () => void;
};

const GROUP_HELP: Record<string, string> = {
    SHIFTS: "Sent from a shift to everyone assigned to it.",
    PROJECTS: "Sent from a project to everyone across its shifts.",
    USERS: "Sent from an account page to that person.",
    APPLICATIONS: "Offered while reviewing an application, split by decision.",
    ONBOARDING: "Offered while reviewing onboarding, split by decision.",
};

export function groupLabel(group: string): string {
    return GROUP_OPTIONS.find((option) => option.value === group)?.label ?? group;
}

export function categoryLabel(category: string): string {
    if (category === "REJECT") return "Reject";
    if (category === "REQUEST_CHANGES") return "Request changes";
    if (category === "ACCEPT") return "Accept";
    return "General";
}

type PresetDraft = {
    id: string | null;
    groupType: string;
    category: string;
    name: string;
    subject: string;
    body: string;
};

const EMPTY_DRAFT: PresetDraft = {
    id: null,
    groupType: "SHIFTS",
    category: "REJECT",
    name: "",
    subject: "",
    body: "",
};

export default function AdminEmailPresets() {
    const { permissions } = useAuth();
    const canManage = permissions.includes("CAN_MANAGE_MESSAGES");

    const [presets, setPresets] = useState<EmailPresetResponseDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [draft, setDraft] = useState<PresetDraft | null>(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [attachments, setAttachments] = useState<EmailPresetAttachmentDTO[]>([]);
    // Files staged while composing a not-yet-saved preset; uploaded once it's created.
    const [pendingFiles, setPendingFiles] = useState<File[]>([]);
    const [attachmentBusy, setAttachmentBusy] = useState(false);
    const [attachmentError, setAttachmentError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const [preview, setPreview] = useState<PreviewTarget | null>(null);
    const [previewDownloading, setPreviewDownloading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setPresets(await UserServices.getEmailPresets());
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load presets.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const grouped = useMemo(() => {
        return GROUP_OPTIONS.map((group) => ({
            group,
            items: presets.filter((preset) => preset.groupType === group.value),
        }));
    }, [presets]);

    const startCreate = () => {
        setFormError(null);
        setAttachmentError(null);
        setAttachments([]);
        setPendingFiles([]);
        setDraft({ ...EMPTY_DRAFT });
    };

    const startEdit = (preset: EmailPresetResponseDTO) => {
        setFormError(null);
        setAttachmentError(null);
        setAttachments(preset.attachments ?? []);
        setPendingFiles([]);
        setDraft({
            id: preset.id,
            groupType: String(preset.groupType),
            category:
                SPLIT_GROUPS.has(String(preset.groupType)) && String(preset.category) !== "GENERAL"
                    ? String(preset.category)
                    : "REJECT",
            name: preset.name,
            subject: preset.subject,
            body: preset.body,
        });
    };

    const closeModal = () => {
        if (saving) return;
        setDraft(null);
        setPendingFiles([]);
        setFormError(null);
    };

    // Routes chosen/dropped files: uploaded immediately for a saved preset, otherwise staged until
    // save. Enforces the size + count caps against a running local count (state is batched).
    const handleAddFiles = async (fileList: FileList | File[] | null) => {
        if (!draft || !fileList) return;
        const files = Array.from(fileList);
        if (files.length === 0) return;
        setAttachmentError(null);
        let count = attachments.length + pendingFiles.length;
        const toStage: File[] = [];
        for (const file of files) {
            if (count >= MAX_ATTACHMENTS) {
                setAttachmentError(`A preset can have at most ${MAX_ATTACHMENTS} attachments.`);
                break;
            }
            if (file.size > MAX_ATTACHMENT_BYTES) {
                setAttachmentError(`"${file.name}" is too large (max 5MB).`);
                continue;
            }
            if (draft.id) {
                await handleUploadAttachment(file);
            } else {
                toStage.push(file);
            }
            count += 1;
        }
        if (toStage.length > 0) {
            setPendingFiles((current) => [...current, ...toStage]);
        }
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleUploadAttachment = async (file: File | null) => {
        if (!file || !draft?.id) return;
        try {
            setAttachmentBusy(true);
            setAttachmentError(null);
            const added = await UserServices.uploadEmailPresetAttachment(draft.id, file);
            setAttachments((current) => [...current, added]);
            await load();
        } catch (err: unknown) {
            setAttachmentError(err instanceof Error ? err.message : "Failed to upload the attachment.");
        } finally {
            setAttachmentBusy(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const downloadUploaded = async (presetId: string, attachment: EmailPresetAttachmentDTO) => {
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

    const previewUploaded = (attachment: EmailPresetAttachmentDTO) => {
        if (!draft?.id) return;
        const presetId = draft.id;
        setPreview({
            fileName: attachment.fileName,
            contentType: attachment.contentType,
            load: () => UserServices.getEmailPresetAttachmentBlob(presetId, attachment.id),
            onDownload: () => void downloadUploaded(presetId, attachment),
        });
    };

    const previewPending = (file: File) => {
        setPreview({
            fileName: file.name,
            contentType: file.type,
            load: () => Promise.resolve(file),
        });
    };

    const handleDeleteAttachment = async (attachmentId: string) => {
        if (!draft?.id) return;
        try {
            setAttachmentBusy(true);
            setAttachmentError(null);
            await UserServices.deleteEmailPresetAttachment(draft.id, attachmentId);
            setAttachments((current) => current.filter((a) => a.id !== attachmentId));
            await load();
        } catch (err: unknown) {
            setAttachmentError(err instanceof Error ? err.message : "Failed to remove the attachment.");
        } finally {
            setAttachmentBusy(false);
        }
    };

    const handleSave = async (event: FormEvent) => {
        event.preventDefault();
        if (!draft) return;
        const bodyHasContent = draft.body.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
        if (!draft.name.trim() || !draft.subject.trim() || !bodyHasContent) {
            setFormError("Name, subject, and body are all required.");
            return;
        }
        const payload: EmailPresetSaveDTO = {
            groupType: draft.groupType,
            category: SPLIT_GROUPS.has(draft.groupType) ? draft.category : undefined,
            name: draft.name.trim(),
            subject: draft.subject.trim(),
            body: draft.body.trim(),
        };
        try {
            setSaving(true);
            setFormError(null);
            if (draft.id) {
                await UserServices.updateEmailPreset(draft.id, payload);
            } else {
                const created = await UserServices.createEmailPreset(payload);
                // Upload the files staged while composing the new preset.
                let failed = 0;
                for (const file of pendingFiles) {
                    try {
                        await UserServices.uploadEmailPresetAttachment(created.id, file);
                    } catch {
                        failed += 1;
                    }
                }
                if (failed > 0) {
                    setError(`Preset saved, but ${failed} attachment${failed === 1 ? "" : "s"} failed to upload. Reopen the preset to retry.`);
                }
            }
            setPendingFiles([]);
            setDraft(null);
            await load();
        } catch (err: unknown) {
            setFormError(err instanceof Error ? err.message : "Failed to save preset.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (preset: EmailPresetResponseDTO) => {
        if (!window.confirm(`Delete preset "${preset.name}"?`)) return;
        try {
            setDeletingId(preset.id);
            await UserServices.deleteEmailPreset(preset.id);
            await load();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to delete preset.");
        } finally {
            setDeletingId(null);
        }
    };

    const isSplit = draft ? SPLIT_GROUPS.has(draft.groupType) : false;

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <main className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/management" />
                            <h1 className="pageTitle">Email presets</h1>
                            <p className="pageSubtitle">
                                Reusable email templates. Shift, project, and user presets can be sent from
                                those pages; application and onboarding presets appear as decision options
                                during review.
                            </p>
                        </header>

                        <div className="adminDashboardCard">
                            <Card
                                title="Presets"
                                right={
                                    <div className="emailPresetToolbar">
                                        <span className="emailPresetCount">
                                            {presets.length} preset{presets.length === 1 ? "" : "s"}
                                        </span>
                                        {canManage ? (
                                            <button className="button" type="button" onClick={startCreate}>
                                                New preset
                                            </button>
                                        ) : null}
                                    </div>
                                }
                            >
                                <div className="emailPresetBody">
                                    {loading ? <div className="emailPresetState">Loading presets…</div> : null}
                                    {error ? <div className="emailPresetState emailPresetState--error">{error}</div> : null}
                                    {!canManage && !loading ? (
                                        <div className="emailPresetState">
                                            You do not have permission to manage email presets.
                                        </div>
                                    ) : null}

                                    {!loading && !error && canManage ? (
                                        <div className="emailPresetGroups">
                                            {grouped.map(({ group, items }) => (
                                                <section key={group.value} className="emailPresetGroup">
                                                    <div className="emailPresetGroupHead">
                                                        <div>
                                                            <h2 className="emailPresetGroupTitle">{group.label}</h2>
                                                            <p className="emailPresetGroupHelp">{GROUP_HELP[group.value]}</p>
                                                        </div>
                                                        <span className="emailPresetGroupCount">{items.length}</span>
                                                    </div>
                                                    {items.length === 0 ? (
                                                        <div className="emailPresetEmpty">No presets yet.</div>
                                                    ) : (
                                                        <ul className="emailPresetList">
                                                            {items.map((preset) => (
                                                                <li key={preset.id} className="emailPresetRow">
                                                                    <div className="emailPresetRowMain">
                                                                        <div className="emailPresetRowName">
                                                                            {preset.name}
                                                                            {SPLIT_GROUPS.has(String(preset.groupType)) ? (
                                                                                <span
                                                                                    className={`emailPresetTag emailPresetTag--${String(preset.category).toLowerCase()}`}
                                                                                >
                                                                                    {categoryLabel(String(preset.category))}
                                                                                </span>
                                                                            ) : null}
                                                                        </div>
                                                                        <div className="emailPresetRowSubject">
                                                                            {preset.subject}
                                                                        </div>
                                                                    </div>
                                                                    <div className="emailPresetRowActions">
                                                                        <button
                                                                            className="buttonSecondary"
                                                                            type="button"
                                                                            onClick={() => startEdit(preset)}
                                                                        >
                                                                            Edit
                                                                        </button>
                                                                        <button
                                                                            className="buttonDanger"
                                                                            type="button"
                                                                            onClick={() => void handleDelete(preset)}
                                                                            disabled={deletingId === preset.id}
                                                                        >
                                                                            {deletingId === preset.id ? "Deleting…" : "Delete"}
                                                                        </button>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </section>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </Card>
                        </div>
                    </main>
                </div>
            </div>

            <Modal
                open={Boolean(draft)}
                onClose={closeModal}
                title={draft?.id ? "Edit preset" : "New preset"}
                hideDefaultFooter
                maxHeight={760}
            >
                {draft ? (
                    <form
                        className="emailPresetForm"
                        onSubmit={(event) => void handleSave(event)}
                        onDragOver={!isSplit ? (event) => event.preventDefault() : undefined}
                        onDragEnter={
                            !isSplit
                                ? (event) => {
                                      event.preventDefault();
                                      if (!saving && !attachmentBusy) setDragActive(true);
                                  }
                                : undefined
                        }
                        onDragLeave={
                            !isSplit
                                ? (event) => {
                                      event.preventDefault();
                                      if (event.currentTarget.contains(event.relatedTarget as Node)) return;
                                      setDragActive(false);
                                  }
                                : undefined
                        }
                        onDrop={
                            !isSplit
                                ? (event) => {
                                      event.preventDefault();
                                      setDragActive(false);
                                      if (!saving && !attachmentBusy) void handleAddFiles(event.dataTransfer.files);
                                  }
                                : undefined
                        }
                    >
                        {dragActive && !isSplit ? (
                            <div className="emailPresetFormDropOverlay">Drop files to attach</div>
                        ) : null}
                        <div className="emailPresetFormGrid">
                            <label className="emailPresetField">
                                <span>Group</span>
                                <select
                                    className="modal_input"
                                    value={draft.groupType}
                                    onChange={(event) =>
                                        setDraft((current) => {
                                            if (!current) return current;
                                            const groupType = event.target.value;
                                            // ACCEPT is invalid outside APPLICATIONS; fall back so we never post a
                                            // category the backend would reject for the new group.
                                            const options = categoryOptionsForGroup(groupType);
                                            const category = options.some((option) => option.value === current.category)
                                                ? current.category
                                                : options[0].value;
                                            return { ...current, groupType, category };
                                        })
                                    }
                                >
                                    {GROUP_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            {isSplit ? (
                                <label className="emailPresetField">
                                    <span>Type</span>
                                    <select
                                        className="modal_input"
                                        value={draft.category}
                                        onChange={(event) =>
                                            setDraft((current) =>
                                                current ? { ...current, category: event.target.value } : current
                                            )
                                        }
                                    >
                                        {categoryOptionsForGroup(draft.groupType).map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            ) : null}
                        </div>
                        {isSplit ? (
                            <p className="emailPresetFieldHint">
                                Each preset is only offered for its own decision — reject when rejecting,
                                request-changes when requesting changes{draft.groupType === "APPLICATIONS" ? ", accept when accepting" : ""}.
                            </p>
                        ) : null}
                        <label className="emailPresetField">
                            <span>Name</span>
                            <input
                                className="modal_input"
                                type="text"
                                value={draft.name}
                                placeholder="Shown in the dropdown"
                                onChange={(event) =>
                                    setDraft((current) => (current ? { ...current, name: event.target.value } : current))
                                }
                            />
                        </label>
                        <label className="emailPresetField">
                            <span>Subject</span>
                            <input
                                className="modal_input"
                                type="text"
                                value={draft.subject}
                                onChange={(event) =>
                                    setDraft((current) =>
                                        current ? { ...current, subject: event.target.value } : current
                                    )
                                }
                            />
                        </label>
                        {!isSplit ? (
                            <div className="emailPresetField">
                                <span>Attachments</span>
                                <div className="emailPresetAttachments">
                                    {attachments.length > 0 || pendingFiles.length > 0 ? (
                                        <div className="emailPresetChips">
                                            {attachments.map((attachment) => {
                                                const badge = fileBadge(attachment.fileName);
                                                return (
                                                    <div
                                                        key={attachment.id}
                                                        className="emailPresetChip"
                                                        role="button"
                                                        tabIndex={0}
                                                        title={`Preview ${attachment.fileName}`}
                                                        onClick={() => previewUploaded(attachment)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === "Enter" || event.key === " ") {
                                                                event.preventDefault();
                                                                previewUploaded(attachment);
                                                            }
                                                        }}
                                                    >
                                                        <span className={`emailPresetChipIcon emailPresetChipIcon--${badge.kind}`}>
                                                            {badge.label}
                                                        </span>
                                                        <div className="emailPresetChipInfo">
                                                            <span className="emailPresetChipName">{attachment.fileName}</span>
                                                            <span className="emailPresetChipSize">
                                                                {formatFileSize(attachment.sizeBytes)}
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="emailPresetChipRemove"
                                                            title="Remove"
                                                            aria-label={`Remove ${attachment.fileName}`}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                void handleDeleteAttachment(attachment.id);
                                                            }}
                                                            disabled={attachmentBusy || saving}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                            {pendingFiles.map((file, index) => {
                                                const badge = fileBadge(file.name);
                                                return (
                                                    <div
                                                        key={`pending-${index}`}
                                                        className="emailPresetChip"
                                                        role="button"
                                                        tabIndex={0}
                                                        title={`Preview ${file.name}`}
                                                        onClick={() => previewPending(file)}
                                                        onKeyDown={(event) => {
                                                            if (event.key === "Enter" || event.key === " ") {
                                                                event.preventDefault();
                                                                previewPending(file);
                                                            }
                                                        }}
                                                    >
                                                        <span className={`emailPresetChipIcon emailPresetChipIcon--${badge.kind}`}>
                                                            {badge.label}
                                                        </span>
                                                        <div className="emailPresetChipInfo">
                                                            <span className="emailPresetChipName">{file.name}</span>
                                                            <span className="emailPresetChipSize">
                                                                {formatFileSize(file.size)} · pending
                                                            </span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="emailPresetChipRemove"
                                                            title="Remove"
                                                            aria-label={`Remove ${file.name}`}
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                setPendingFiles((current) => current.filter((_, i) => i !== index));
                                                            }}
                                                            disabled={saving}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : null}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        className="emailPresetHiddenFile"
                                        onChange={(event) => void handleAddFiles(event.target.files)}
                                    />
                                    {attachments.length + pendingFiles.length < MAX_ATTACHMENTS ? (
                                        <div className="emailPresetFieldHint">
                                            Drag files onto the email to attach them.
                                        </div>
                                    ) : null}
                                    {!draft.id ? (
                                        <span className="emailPresetFieldHint">Files attach when you save the preset.</span>
                                    ) : null}
                                    {attachmentBusy ? <span className="emailPresetFieldHint">Working…</span> : null}
                                    {attachmentError ? (
                                        <div className="emailPresetFormError">{attachmentError}</div>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}

                        <div className="emailPresetField">
                            <span>Body</span>
                            <RichTextEditor
                                value={draft.body}
                                resetKey={draft.id ?? "new"}
                                onChange={(html) =>
                                    setDraft((current) => (current ? { ...current, body: html } : current))
                                }
                            />
                            <span className="emailPresetFieldHint">
                                Use <strong>Insert</strong> for links (reset password, apply, planning…) and the
                                recipient's name. Links work in every environment.
                            </span>
                        </div>

                        {formError ? <div className="emailPresetFormError">{formError}</div> : null}
                        <div className="emailPresetFormActions">
                            <button
                                className="buttonSecondary"
                                type="button"
                                onClick={closeModal}
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button className="button" type="submit" disabled={saving}>
                                {saving ? "Saving…" : "Save preset"}
                            </button>
                        </div>
                    </form>
                ) : null}
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
