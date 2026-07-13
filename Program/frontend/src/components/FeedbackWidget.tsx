import { type JSX, useCallback, useEffect, useRef, useState } from "react";
import { UserServices } from "../services/user-service/UserServices";
import type { FeedbackCategory, FeedbackEntryDTO } from "../services/user-service/Feedback";
import { formatDateTime } from "../utils/dateFormat";
import "../stylesheets/FeedbackWidget.css";

type Tab = "leave" | "read" | "progress";

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string }[] = [
    { value: "FEATURE", label: "Feature" },
    { value: "BUG", label: "Bug" },
    { value: "CLEANUP", label: "Clean up" },
];

const categoryLabel = (value: string): string =>
    CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? value;

const isFinished = (entry: FeedbackEntryDTO): boolean => String(entry.status) === "FINISHED";

const formatCount = (value: number): string => (value > 99 ? "99+" : String(value));

const MAX_LENGTH = 4000;

type FeedbackWidgetProps = {
    /**
     * Render as a fixed button in the bottom-right corner instead of an inline navbar
     * pill. Used on pages that have no navbar (e.g. /apply, /onboarding).
     */
    floating?: boolean;
};

export default function FeedbackWidget({ floating = false }: FeedbackWidgetProps): JSX.Element {
    const rootRef = useRef<HTMLDivElement | null>(null);

    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("leave");

    // Compose form (leave tab)
    const [category, setCategory] = useState<FeedbackCategory>("FEATURE");
    const [body, setBody] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    // Shared list
    const [entries, setEntries] = useState<FeedbackEntryDTO[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [listError, setListError] = useState<string | null>(null);

    // Inline edit / row-action state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editCategory, setEditCategory] = useState<FeedbackCategory>("FEATURE");
    const [editBody, setEditBody] = useState("");
    const [editSubmitting, setEditSubmitting] = useState(false);
    const [rowError, setRowError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

    const pendingEntries = entries.filter((entry) => !isFinished(entry));
    const finishedEntries = entries.filter((entry) => isFinished(entry));
    const pendingCount = pendingEntries.length;
    const finishedCount = finishedEntries.length;

    const loadList = useCallback(async () => {
        setListLoading(true);
        setListError(null);
        try {
            const data = await UserServices.getFeedback();
            setEntries(data);
        } catch (err: unknown) {
            setListError(err instanceof Error ? err.message : "Could not load feedback");
        } finally {
            setListLoading(false);
        }
    }, []);

    // Load once on mount so the pending-count badge is accurate without opening the
    // panel. On sign-in-gated pages an anonymous visitor just gets a quiet 401 (no badge).
    useEffect(() => {
        void loadList();
    }, [loadList]);

    // Refresh when the panel is opened so counts and the lists stay current.
    useEffect(() => {
        if (open) void loadList();
    }, [open, loadList]);

    // Close on outside click / Escape, matching the other navbar dropdowns.
    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (rootRef.current && !rootRef.current.contains(target)) {
                setOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setOpen(false);
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("touchstart", handlePointerDown, { passive: true });
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("touchstart", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    const resetCompose = () => {
        setCategory("FEATURE");
        setBody("");
        setSubmitError(null);
    };

    const handleToggle = () => {
        setOpen((prev) => !prev);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        const trimmed = body.trim();
        if (!trimmed) {
            setSubmitError("Please write your feedback first.");
            return;
        }
        setSubmitting(true);
        setSubmitError(null);
        try {
            const created = await UserServices.createFeedback({ category, body: trimmed });
            setEntries((prev) => [created, ...prev]);
            resetCompose();
            setActiveTab("read");
        } catch (err: unknown) {
            setSubmitError(err instanceof Error ? err.message : "Could not submit your feedback");
        } finally {
            setSubmitting(false);
        }
    };

    const startEdit = (entry: FeedbackEntryDTO) => {
        setEditingId(entry.feedbackId);
        setEditCategory((entry.category as FeedbackCategory) ?? "FEATURE");
        setEditBody(entry.body);
        setRowError(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditBody("");
        setRowError(null);
    };

    const handleSaveEdit = async (feedbackId: string) => {
        const trimmed = editBody.trim();
        if (!trimmed) {
            setRowError("Feedback text is required.");
            return;
        }
        setEditSubmitting(true);
        setRowError(null);
        try {
            const updated = await UserServices.updateFeedback(feedbackId, {
                category: editCategory,
                body: trimmed,
            });
            setEntries((prev) => prev.map((item) => (item.feedbackId === feedbackId ? updated : item)));
            cancelEdit();
        } catch (err: unknown) {
            setRowError(err instanceof Error ? err.message : "Could not update your feedback");
        } finally {
            setEditSubmitting(false);
        }
    };

    const handleDelete = async (feedbackId: string) => {
        setDeletingId(feedbackId);
        setRowError(null);
        try {
            await UserServices.deleteFeedback(feedbackId);
            setEntries((prev) => prev.filter((item) => item.feedbackId !== feedbackId));
            if (editingId === feedbackId) cancelEdit();
        } catch (err: unknown) {
            setRowError(err instanceof Error ? err.message : "Could not delete your feedback");
        } finally {
            setDeletingId(null);
        }
    };

    const handleToggleStatus = async (entry: FeedbackEntryDTO) => {
        const next = isFinished(entry) ? "PENDING" : "FINISHED";
        setStatusUpdatingId(entry.feedbackId);
        setRowError(null);
        try {
            const updated = await UserServices.updateFeedbackStatus(entry.feedbackId, next);
            setEntries((prev) => prev.map((item) => (item.feedbackId === entry.feedbackId ? updated : item)));
        } catch (err: unknown) {
            setRowError(err instanceof Error ? err.message : "Could not update the feedback status");
        } finally {
            setStatusUpdatingId(null);
        }
    };

    const renderProgressItem = (entry: FeedbackEntryDTO) => {
        const finished = isFinished(entry);
        const busy = statusUpdatingId === entry.feedbackId;
        return (
            <div
                className={`feedback_item${finished ? " feedback_item--done" : ""}`}
                key={entry.feedbackId}
            >
                <div className="feedback_item_head">
                    <span
                        className={`feedback_badge feedback_badge--${String(entry.category).toLowerCase()}`}
                    >
                        {categoryLabel(String(entry.category))}
                    </span>
                    <span className="feedback_author">{entry.authorName}</span>
                    <span className="feedback_time">{formatDateTime(entry.createdAt)}</span>
                </div>
                <p className="feedback_body">{entry.body}</p>
                <div className="feedback_row_actions">
                    <button
                        type="button"
                        className={`feedback_link_btn${finished ? " feedback_link_btn--muted" : ""}`}
                        onClick={() => void handleToggleStatus(entry)}
                        disabled={busy}
                    >
                        {busy ? "Saving..." : finished ? "Reopen" : "Mark done"}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div
            className={`feedback_widget${floating ? " feedback_widget--floating" : ""}`}
            ref={rootRef}
        >
            <button
                type="button"
                className={`feedback_trigger${open ? " feedback_trigger--active" : ""}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={pendingCount > 0 ? `Give feedback, ${pendingCount} pending` : "Give feedback"}
                title="Give feedback"
                onClick={handleToggle}
            >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                    <path d="M8 10h8M8 13h5" />
                </svg>
                <span className="feedback_trigger_label">Feedback</span>
                {pendingCount > 0 ? (
                    <span className="feedback_count_badge" aria-hidden="true">
                        {formatCount(pendingCount)}
                    </span>
                ) : null}
            </button>

            {open ? (
                <div className="feedback_panel" role="dialog" aria-label="Feedback">
                    <div className="feedback_tabs" role="tablist" aria-label="Feedback tabs">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "leave"}
                            className={`feedback_tab${activeTab === "leave" ? " feedback_tab--active" : ""}`}
                            onClick={() => setActiveTab("leave")}
                        >
                            Leave
                        </button>
                        {/* Each tab's counter reflects the list that tab actually
                            shows: Progress counts the pending items (attention
                            red), Done counts the finished ones (muted). */}
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "read"}
                            className={`feedback_tab${activeTab === "read" ? " feedback_tab--active" : ""}`}
                            onClick={() => setActiveTab("read")}
                        >
                            Progress
                            {pendingCount > 0 ? (
                                <span className="feedback_tab_badge" aria-hidden="true">
                                    {formatCount(pendingCount)}
                                </span>
                            ) : null}
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === "progress"}
                            className={`feedback_tab${activeTab === "progress" ? " feedback_tab--active" : ""}`}
                            onClick={() => setActiveTab("progress")}
                        >
                            Done
                            {finishedCount > 0 ? (
                                <span className="feedback_tab_badge feedback_tab_badge--muted" aria-hidden="true">
                                    {formatCount(finishedCount)}
                                </span>
                            ) : null}
                        </button>
                    </div>

                    {activeTab === "leave" ? (
                        <form className="feedback_compose" onSubmit={handleSubmit}>
                            <label className="feedback_field">
                                <span className="feedback_field_label">Type</span>
                                <select
                                    className="feedback_select"
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
                                    disabled={submitting}
                                >
                                    {CATEGORY_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <label className="feedback_field">
                                <span className="feedback_field_label">Your feedback</span>
                                <textarea
                                    className="feedback_textarea"
                                    placeholder="What would you like to share?"
                                    value={body}
                                    maxLength={MAX_LENGTH}
                                    onChange={(e) => setBody(e.target.value)}
                                    disabled={submitting}
                                    rows={4}
                                />
                            </label>
                            {submitError ? <div className="feedback_error">{submitError}</div> : null}
                            <div className="feedback_compose_actions">
                                <button
                                    type="submit"
                                    className="feedback_submit"
                                    disabled={submitting || body.trim().length === 0}
                                >
                                    {submitting ? "Sending..." : "Send feedback"}
                                </button>
                            </div>
                        </form>
                    ) : activeTab === "read" ? (
                        <div className="feedback_list">
                            {listLoading && entries.length === 0 ? (
                                <div className="feedback_empty">Loading feedback...</div>
                            ) : listError ? (
                                <div className="feedback_error">{listError}</div>
                            ) : pendingEntries.length === 0 ? (
                                <div className="feedback_empty">
                                    Nothing in progress — check the Done tab.
                                </div>
                            ) : (
                                pendingEntries.map((entry) => {
                                    const isEditing = editingId === entry.feedbackId;
                                    return (
                                        <div className="feedback_item" key={entry.feedbackId}>
                                            <div className="feedback_item_head">
                                                <span
                                                    className={`feedback_badge feedback_badge--${String(
                                                        entry.category
                                                    ).toLowerCase()}`}
                                                >
                                                    {categoryLabel(String(entry.category))}
                                                </span>
                                                <span className="feedback_author">{entry.authorName}</span>
                                                <span className="feedback_time">
                                                    {formatDateTime(entry.createdAt)}
                                                    {entry.updatedAt ? " (edited)" : ""}
                                                </span>
                                            </div>

                                            {isEditing ? (
                                                <div className="feedback_edit">
                                                    <select
                                                        className="feedback_select"
                                                        value={editCategory}
                                                        onChange={(e) =>
                                                            setEditCategory(e.target.value as FeedbackCategory)
                                                        }
                                                        disabled={editSubmitting}
                                                    >
                                                        {CATEGORY_OPTIONS.map((option) => (
                                                            <option key={option.value} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <textarea
                                                        className="feedback_textarea"
                                                        value={editBody}
                                                        maxLength={MAX_LENGTH}
                                                        onChange={(e) => setEditBody(e.target.value)}
                                                        disabled={editSubmitting}
                                                        rows={3}
                                                    />
                                                    {rowError ? (
                                                        <div className="feedback_error">{rowError}</div>
                                                    ) : null}
                                                    <div className="feedback_row_actions">
                                                        <button
                                                            type="button"
                                                            className="feedback_link_btn"
                                                            onClick={() => void handleSaveEdit(entry.feedbackId)}
                                                            disabled={editSubmitting}
                                                        >
                                                            {editSubmitting ? "Saving..." : "Save"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="feedback_link_btn feedback_link_btn--muted"
                                                            onClick={cancelEdit}
                                                            disabled={editSubmitting}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="feedback_body">{entry.body}</p>
                                                    <div className="feedback_row_actions">
                                                        <button
                                                            type="button"
                                                            className="feedback_link_btn"
                                                            onClick={() => void handleToggleStatus(entry)}
                                                            disabled={statusUpdatingId === entry.feedbackId}
                                                        >
                                                            {statusUpdatingId === entry.feedbackId
                                                                ? "Saving..."
                                                                : "Mark done"}
                                                        </button>
                                                        {entry.mine ? (
                                                            <>
                                                                <button
                                                                    type="button"
                                                                    className="feedback_link_btn"
                                                                    onClick={() => startEdit(entry)}
                                                                >
                                                                    Edit
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="feedback_link_btn feedback_link_btn--danger"
                                                                    onClick={() => void handleDelete(entry.feedbackId)}
                                                                    disabled={deletingId === entry.feedbackId}
                                                                >
                                                                    {deletingId === entry.feedbackId
                                                                        ? "Deleting..."
                                                                        : "Delete"}
                                                                </button>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                    {rowError &&
                                                    (deletingId === entry.feedbackId ||
                                                        statusUpdatingId === entry.feedbackId) ? (
                                                        <div className="feedback_error">{rowError}</div>
                                                    ) : null}
                                                </>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    ) : (
                        <div className="feedback_list">
                            {listLoading && entries.length === 0 ? (
                                <div className="feedback_empty">Loading feedback...</div>
                            ) : listError ? (
                                <div className="feedback_error">{listError}</div>
                            ) : finishedEntries.length === 0 ? (
                                <div className="feedback_empty">Nothing marked done yet.</div>
                            ) : (
                                <>
                                    {finishedEntries.map(renderProgressItem)}
                                    {rowError ? <div className="feedback_error">{rowError}</div> : null}
                                </>
                            )}
                        </div>
                    )}
                </div>
            ) : null}
        </div>
    );
}
