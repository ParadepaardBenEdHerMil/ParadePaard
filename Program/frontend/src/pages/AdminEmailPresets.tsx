import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import { useAuth } from "../context/AuthContext";
import { UserServices } from "../services/user-service/UserServices";
import type {
    EmailPresetResponseDTO,
    EmailPresetSaveDTO,
} from "../services/user-service/EmailPresets";

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
] as const;

// Groups whose presets must be classified as reject vs. request-changes so the two can never cross.
const SPLIT_GROUPS = new Set(["APPLICATIONS", "ONBOARDING"]);

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
        setDraft({ ...EMPTY_DRAFT });
    };

    const startEdit = (preset: EmailPresetResponseDTO) => {
        setFormError(null);
        setDraft({
            id: preset.id,
            groupType: String(preset.groupType),
            category:
                SPLIT_GROUPS.has(String(preset.groupType)) && String(preset.category) === "REQUEST_CHANGES"
                    ? "REQUEST_CHANGES"
                    : "REJECT",
            name: preset.name,
            subject: preset.subject,
            body: preset.body,
        });
    };

    const closeModal = () => {
        if (saving) return;
        setDraft(null);
        setFormError(null);
    };

    const handleSave = async (event: FormEvent) => {
        event.preventDefault();
        if (!draft) return;
        if (!draft.name.trim() || !draft.subject.trim() || !draft.body.trim()) {
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
                await UserServices.createEmailPreset(payload);
            }
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
                                those pages; application and onboarding presets appear as reject or
                                request-changes options during review.
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
                    <form className="emailPresetForm" onSubmit={(event) => void handleSave(event)}>
                        <div className="emailPresetFormGrid">
                            <label className="emailPresetField">
                                <span>Group</span>
                                <select
                                    className="modal_input"
                                    value={draft.groupType}
                                    onChange={(event) =>
                                        setDraft((current) =>
                                            current ? { ...current, groupType: event.target.value } : current
                                        )
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
                                        {CATEGORY_OPTIONS.map((option) => (
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
                                Reject presets are only offered when rejecting; request-changes presets only when
                                requesting changes.
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
                        <label className="emailPresetField">
                            <span>Body</span>
                            <textarea
                                className="modal_input emailPresetTextarea"
                                rows={9}
                                value={draft.body}
                                onChange={(event) =>
                                    setDraft((current) => (current ? { ...current, body: event.target.value } : current))
                                }
                            />
                        </label>
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
        </>
    );
}
