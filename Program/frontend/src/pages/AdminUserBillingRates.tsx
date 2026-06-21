import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import BillingRateColumnFilter from "../components/common/BillingRateColumnFilter";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import {
    UserServices,
    type BillingRateDTO,
    type BillingRateSaveDTO,
    type PlanningClientCompanyDTO,
    type PlanningProjectDTO,
    type UserBillingRatesDTO,
} from "../services/user-service/UserServices";
import { billingRateFilterMatches, getUniqueBillingRateFilterOptions } from "../utils/billingRateFilters";
import { billingRateScopeLabel, billingRateSectionCountLabel } from "../utils/billingRates";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminPlanningClients.css";
import "../stylesheets/common/BillingRateManagement.css";

const EMPTY_DATA: UserBillingRatesDTO = {
    userId: "",
    clientOverrides: [],
    projectOverrides: [],
};

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
});

type UserBillingRateFilters = {
    clientQuery: string;
    projectQuery: string;
    functionQuery: string;
    scopeQuery: string;
};

type UserBillingRateModalKind = "employee" | "projectEmployee";
type UserBillingRateDraft = BillingRateSaveDTO & {
    editingRateId?: string | null;
    clientCompanyId: string;
    defaultForAllProjects: boolean;
};

const EMPTY_FILTERS: UserBillingRateFilters = {
    clientQuery: "",
    projectQuery: "",
    functionQuery: "",
    scopeQuery: "",
};

const EMPTY_DRAFT: UserBillingRateDraft = {
    editingRateId: null,
    clientCompanyId: "",
    functionName: "",
    ratePerHour: 0,
    projectId: "",
    userId: "",
    effectiveFrom: "",
    effectiveTo: "",
    notes: "",
    defaultForAllProjects: true,
};

const DEFAULT_PROJECT_LABEL = "Default for all projects";

function money(value?: number | null): string {
    return value == null ? "-" : `${currencyFormatter.format(value)}/h`;
}

function clientLabel(row: BillingRateDTO): string {
    return row.clientName || row.clientCompanyId || "-";
}

function projectLabel(row: BillingRateDTO): string {
    return row.projectName || DEFAULT_PROJECT_LABEL;
}

function scopeLabel(row: BillingRateDTO): string {
    return billingRateScopeLabel(row.scope);
}

export function getFilteredUserBillingRateRows(
    rows: BillingRateDTO[],
    filters: UserBillingRateFilters
): BillingRateDTO[] {
    return rows.filter((row) => {
        return (
            billingRateFilterMatches(clientLabel(row), filters.clientQuery) &&
            billingRateFilterMatches(projectLabel(row), filters.projectQuery) &&
            billingRateFilterMatches(row.functionName, filters.functionQuery) &&
            billingRateFilterMatches(scopeLabel(row), filters.scopeQuery)
        );
    });
}

export function getUserBillingRateModalKind(
    draft: Pick<UserBillingRateDraft, "defaultForAllProjects">
): UserBillingRateModalKind {
    return draft.defaultForAllProjects ? "employee" : "projectEmployee";
}

export function createUserBillingRateDraftFromRow(row: BillingRateDTO): UserBillingRateDraft {
    return {
        editingRateId: row.id,
        clientCompanyId: row.clientCompanyId,
        functionName: row.functionName,
        ratePerHour: row.ratePerHour,
        projectId: row.projectId ?? "",
        userId: row.userId ?? "",
        effectiveFrom: row.effectiveFrom ?? "",
        effectiveTo: row.effectiveTo ?? "",
        notes: row.notes ?? "",
        defaultForAllProjects: !row.projectId,
    };
}

export function isUserBillingRateSaveDisabled({
    saving,
    draft,
}: {
    saving: boolean;
    draft: UserBillingRateDraft;
}): boolean {
    return (
        saving ||
        !draft.clientCompanyId ||
        !draft.functionName.trim() ||
        !draft.ratePerHour ||
        (!draft.defaultForAllProjects && !draft.projectId)
    );
}

function RateList({
    title,
    rows,
    emptyLabel,
    onEdit,
    onDelete,
}: {
    title: string;
    rows: BillingRateDTO[];
    emptyLabel: string;
    onEdit: (row: BillingRateDTO) => void;
    onDelete: (row: BillingRateDTO) => void;
}) {
    const [filters, setFilters] = useState<UserBillingRateFilters>(EMPTY_FILTERS);
    const visibleRows = useMemo(() => getFilteredUserBillingRateRows(rows, filters), [rows, filters]);
    const clientOptions = getUniqueBillingRateFilterOptions(rows.map(clientLabel));
    const projectOptions = getUniqueBillingRateFilterOptions(rows.map(projectLabel));
    const functionOptions = getUniqueBillingRateFilterOptions(rows.map((row) => row.functionName));
    const scopeOptions = getUniqueBillingRateFilterOptions(rows.map(scopeLabel));

    return (
        <section className="billingRatesSection">
            <div className="billingRatesSectionHeader">
                <h3>{title}</h3>
                <span>{billingRateSectionCountLabel({ visible: visibleRows.length, total: rows.length, emptyLabel })}</span>
            </div>
            <div className="listContainer billingRatesListContainer">
                <div className="listHeaderGrid billingRatesGridUser">
                    <BillingRateColumnFilter
                        label="Client"
                        value={filters.clientQuery}
                        allLabel="All clients"
                        searchPlaceholder="Search clients"
                        options={clientOptions}
                        variant="header"
                        onChange={(value) => setFilters((current) => ({ ...current, clientQuery: value }))}
                    />
                    <BillingRateColumnFilter
                        label="Project"
                        value={filters.projectQuery}
                        allLabel="All projects"
                        searchPlaceholder="Search projects"
                        options={projectOptions}
                        variant="header"
                        onChange={(value) => setFilters((current) => ({ ...current, projectQuery: value }))}
                    />
                    <BillingRateColumnFilter
                        label="Function"
                        value={filters.functionQuery}
                        allLabel="All functions"
                        searchPlaceholder="Search functions"
                        options={functionOptions}
                        variant="header"
                        onChange={(value) => setFilters((current) => ({ ...current, functionQuery: value }))}
                    />
                    <span>Rate</span>
                    <BillingRateColumnFilter
                        label="Scope"
                        value={filters.scopeQuery}
                        allLabel="All scopes"
                        searchPlaceholder="Search scopes"
                        options={scopeOptions}
                        variant="header"
                        onChange={(value) => setFilters((current) => ({ ...current, scopeQuery: value }))}
                    />
                    <span>Actions</span>
                </div>
                <div className="listScrollArea billingRatesListScroll">
                    {visibleRows.length === 0 ? (
                        <div className="billingRatesEmpty">{emptyLabel}</div>
                    ) : (
                        visibleRows.map((row) => (
                            <div
                                className="listRowGrid billingRatesGridUser clickableRow billingRatesRow"
                                key={`${row.scope}-${row.id}`}
                                role="button"
                                tabIndex={0}
                                onClick={() => onEdit(row)}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                        event.preventDefault();
                                        onEdit(row);
                                    }
                                }}
                            >
                                <span className="billingRatesRowPrimary">{clientLabel(row)}</span>
                                <span className="billingRatesRowSecondary">{projectLabel(row)}</span>
                                <span className="billingRatesRowSecondary">{row.functionName}</span>
                                <strong className="billingRatesRowValue">{money(row.ratePerHour)}</strong>
                                <span className="billingRatesRowSecondary">{scopeLabel(row)}</span>
                                <span className="billingRatesActionsCell">
                                    <button
                                        type="button"
                                        className="buttonSecondary"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onEdit(row);
                                        }}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        className="buttonDanger"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onDelete(row);
                                        }}
                                    >
                                        Delete
                                    </button>
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </section>
    );
}

export default function AdminUserBillingRates() {
    const { userId } = useParams<{ userId: string }>();
    const [data, setData] = useState<UserBillingRatesDTO>(EMPTY_DATA);
    const [clients, setClients] = useState<PlanningClientCompanyDTO[]>([]);
    const [projects, setProjects] = useState<PlanningProjectDTO[]>([]);
    const [loading, setLoading] = useState(false);
    const [metadataLoading, setMetadataLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [draft, setDraft] = useState<UserBillingRateDraft>(EMPTY_DRAFT);
    const [deleteTarget, setDeleteTarget] = useState<BillingRateDTO | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);
        UserServices.getUserBillingRates(userId)
            .then((response) => {
                if (!cancelled) setData(response);
            })
            .catch((err: unknown) => {
                if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load billing rates.");
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [userId]);

    useEffect(() => {
        let cancelled = false;
        setMetadataLoading(true);
        Promise.all([
            UserServices.getPlanningClients().catch(() => []),
            UserServices.getPlanningOverview(undefined, undefined, { includeAllocationDetails: false }).catch(() => []),
        ])
            .then(([loadedClients, loadedProjects]) => {
                if (cancelled) return;
                setClients(loadedClients);
                setProjects(loadedProjects);
            })
            .finally(() => {
                if (!cancelled) setMetadataLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    async function loadRates() {
        if (!userId) return;
        const response = await UserServices.getUserBillingRates(userId);
        setData(response);
    }

    function openCreateModal() {
        setDraft({ ...EMPTY_DRAFT, userId: userId ?? "" });
        setSaveError(null);
        setModalOpen(true);
    }

    function openEditModal(row: BillingRateDTO) {
        setDraft(createUserBillingRateDraftFromRow(row));
        setSaveError(null);
        setModalOpen(true);
    }

    function closeModal() {
        if (saving) return;
        setModalOpen(false);
        setSaveError(null);
        setDraft(EMPTY_DRAFT);
    }

    async function handleSave(event: FormEvent) {
        event.preventDefault();
        if (!userId) return;
        const modalKind = getUserBillingRateModalKind(draft);
        const payload: BillingRateSaveDTO = {
            functionName: draft.functionName.trim(),
            ratePerHour: Number(draft.ratePerHour),
            projectId: draft.defaultForAllProjects ? null : draft.projectId?.trim() || null,
            userId,
            effectiveFrom: draft.effectiveFrom?.trim() || null,
            effectiveTo: draft.effectiveTo?.trim() || null,
            notes: draft.notes?.trim() || null,
        };

        try {
            setSaving(true);
            setSaveError(null);
            if (modalKind === "employee") {
                await UserServices.saveClientEmployeeBillingRate(draft.clientCompanyId, payload);
            } else {
                await UserServices.saveProjectEmployeeBillingRate(draft.clientCompanyId, payload);
            }
            setModalOpen(false);
            await loadRates();
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : "Failed to save billing rate.");
        } finally {
            setSaving(false);
        }
    }

    function openDeletePrompt(row: BillingRateDTO) {
        setDeleteTarget(row);
        setDeleteError(null);
    }

    function closeDeletePrompt() {
        if (deleting) return;
        setDeleteTarget(null);
        setDeleteError(null);
    }

    async function handleDelete() {
        if (!deleteTarget || !userId) return;
        try {
            setDeleting(true);
            setDeleteError(null);
            await UserServices.deleteBillingRate(deleteTarget.clientCompanyId, deleteTarget.scope, deleteTarget.id);
            setDeleteTarget(null);
            await loadRates();
        } catch (err: unknown) {
            setDeleteError(err instanceof Error ? err.message : "Failed to delete billing rate.");
        } finally {
            setDeleting(false);
        }
    }

    const editing = Boolean(draft.editingRateId);
    const saveDisabled = isUserBillingRateSaveDisabled({ saving, draft });
    const clientProjects = projects.filter((project) => project.clientCompanyId === draft.clientCompanyId);

    return (
        <section className="adminUserDetailsTabPanel">
            <Card
                title="Billing rates"
                className="adminUserDetailsPanel adminUserDetailsPanel--wide billingRatesCard"
                right={
                    <div className="adminUsersToolbar billingRatesToolbar">
                        <button type="button" className="button" onClick={openCreateModal}>
                            Add billing rate
                        </button>
                    </div>
                }
            >
                {loading ? <div className="billingRatesState">Loading billing rates...</div> : null}
                {error ? <div className="workHistoryError">{error}</div> : null}
                {!loading && !error ? (
                    <div className="billingRatesLayout">
                        <RateList
                            title="Client-level overrides"
                            rows={data.clientOverrides}
                            emptyLabel="No client-level overrides"
                            onEdit={openEditModal}
                            onDelete={openDeletePrompt}
                        />
                        <RateList
                            title="Project-level overrides"
                            rows={data.projectOverrides}
                            emptyLabel="No project-level overrides"
                            onEdit={openEditModal}
                            onDelete={openDeletePrompt}
                        />
                    </div>
                ) : null}
            </Card>

            <Modal
                open={Boolean(deleteTarget)}
                onClose={closeDeletePrompt}
                title="Delete billing rate"
                hideDefaultFooter
                maxHeight={440}
            >
                <div className="billingRatesDeletePrompt">
                    <p className="billingRatesDeleteText">
                        Delete billing rate for <strong>{deleteTarget?.functionName ?? "this function"}</strong>?
                    </p>
                    <p className="billingRatesDeleteWarning">
                        This removes the selected billing-rate override for this user.
                    </p>
                    {deleteError ? <div className="workHistoryError">{deleteError}</div> : null}
                    <div className="billingRatesActions">
                        <button type="button" className="buttonSecondary" onClick={closeDeletePrompt} disabled={deleting}>
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="buttonDanger"
                            onClick={() => void handleDelete()}
                            disabled={deleting}
                        >
                            {deleting ? "Deleting..." : "Delete"}
                        </button>
                    </div>
                </div>
            </Modal>

            <Modal
                open={modalOpen}
                onClose={closeModal}
                title={editing ? "Update billing rate" : "Save billing rate"}
                hideDefaultFooter
                maxHeight={640}
            >
                <form className="billingRatesForm" onSubmit={(event) => void handleSave(event)}>
                    <label>
                        <span>Client</span>
                        <select
                            className="modal_input"
                            value={draft.clientCompanyId}
                            onChange={(event) => setDraft((current) => ({
                                ...current,
                                clientCompanyId: event.target.value,
                                projectId: "",
                            }))}
                            disabled={saving || editing || metadataLoading}
                        >
                            <option value="">Select client</option>
                            {clients.map((client) => (
                                <option key={client.clientCompanyId} value={client.clientCompanyId}>
                                    {client.name || client.clientCompanyId}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        <span>Function</span>
                        <input
                            className="modal_input"
                            value={draft.functionName}
                            onChange={(event) => setDraft((current) => ({ ...current, functionName: event.target.value }))}
                            disabled={saving || editing}
                        />
                    </label>
                    <label>
                        <span>Rate per hour</span>
                        <span className="billingRatesMoneyInput">
                            <span className="billingRatesMoneyPrefix" aria-hidden="true">€</span>
                            <input
                                className="modal_input billingRatesMoneyField"
                                type="number"
                                min="0"
                                step="0.01"
                                value={draft.ratePerHour || ""}
                                onChange={(event) => setDraft((current) => ({ ...current, ratePerHour: Number(event.target.value) }))}
                                disabled={saving}
                            />
                        </span>
                    </label>
                    <label className="billingRatesCheckboxLabel">
                        <input
                            type="checkbox"
                            checked={draft.defaultForAllProjects}
                            onChange={(event) => setDraft((current) => ({
                                ...current,
                                defaultForAllProjects: event.target.checked,
                                projectId: event.target.checked ? "" : current.projectId,
                            }))}
                            disabled={saving || editing}
                        />
                        <span>Default for all projects</span>
                    </label>
                    {!draft.defaultForAllProjects ? (
                        <label>
                            <span>Project</span>
                            <select
                                className="modal_input"
                                value={draft.projectId ?? ""}
                                onChange={(event) => setDraft((current) => ({ ...current, projectId: event.target.value }))}
                                disabled={saving || editing || !draft.clientCompanyId || metadataLoading}
                            >
                                <option value="">Select project</option>
                                {clientProjects.map((project) => (
                                    <option key={project.projectId} value={project.projectId}>
                                        {project.projectName || project.projectId}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}
                    <label>
                        <span>Notes</span>
                        <textarea
                            className="modal_input"
                            value={draft.notes ?? ""}
                            onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                            disabled={saving}
                        />
                    </label>
                    {saveError ? <div className="workHistoryError">{saveError}</div> : null}
                    <div className="billingRatesActions">
                        <button type="button" className="buttonSecondary" onClick={closeModal} disabled={saving}>
                            Cancel
                        </button>
                        <button type="submit" className="button" disabled={saveDisabled}>
                            {saving ? "Saving..." : editing ? "Update billing rate" : "Save billing rate"}
                        </button>
                    </div>
                </form>
            </Modal>
        </section>
    );
}
