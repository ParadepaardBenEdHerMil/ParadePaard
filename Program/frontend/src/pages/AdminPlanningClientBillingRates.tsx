import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import BillingRateColumnFilter from "../components/common/BillingRateColumnFilter";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import {
    UserServices,
    type BillingRateDTO,
    type BillingRateSaveDTO,
    type ClientBillingRatesDTO,
    type PlanningProjectDTO,
    type UserResponseDTO,
} from "../services/user-service/UserServices";
import { getUniqueBillingRateFilterOptions } from "../utils/billingRateFilters";
import type { ClientDetailOutletContext } from "./AdminPlanningClientDetail";
import "../stylesheets/AdminLists.css";
import "../stylesheets/common/BillingRateManagement.css";

const EMPTY_DATA: ClientBillingRatesDTO = {
    defaultRates: [],
    projectRates: [],
    employeeOverrides: [],
    projectEmployeeOverrides: [],
};

type BillingRateModalKind = "default" | "project" | "employee" | "projectEmployee";
type UnifiedBillingRateDraft = BillingRateSaveDTO & {
    editingRateId?: string | null;
    defaultForAllProjects: boolean;
    defaultForAllEmployees: boolean;
};

const EMPTY_DRAFT: UnifiedBillingRateDraft = {
    functionName: "",
    ratePerHour: 0,
    projectId: "",
    userId: "",
    effectiveFrom: "",
    effectiveTo: "",
    notes: "",
    editingRateId: null,
    defaultForAllProjects: true,
    defaultForAllEmployees: true,
};

type CombinedBillingRateRow = BillingRateDTO & {
    projectLabel: string;
    employeeLabel: string;
};
type BillingRateTableFilters = {
    functionQuery: string;
    projectQuery: string;
    employeeQuery: string;
};

const DEFAULT_PROJECT_LABEL = "Default for all projects";
const DEFAULT_EMPLOYEE_LABEL = "Default for all employees";
export const BILLING_RATE_SCOPE_LOCK_NOTE =
    "Scope is locked while editing. Add a new billing rate to use a different project or employee scope.";

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
});

function money(value?: number | null): string {
    return value == null ? "-" : `${currencyFormatter.format(value)}/h`;
}

function dateLabel(value?: string | null): string {
    if (!value) return "-";
    return value.slice(0, 10);
}

function projectDateRange(project: PlanningProjectDTO): string {
    if (!project.startDate && !project.endDate) return "";
    if (project.startDate === project.endDate || !project.endDate) return dateLabel(project.startDate);
    return `${dateLabel(project.startDate)} - ${dateLabel(project.endDate)}`;
}

export function getBillingRateProjectOptions(
    projects: PlanningProjectDTO[],
    clientCompanyId: string,
    query = ""
): PlanningProjectDTO[] {
    const normalizedQuery = query.trim().toLowerCase();

    return projects.filter((project) => {
        if (project.clientCompanyId !== clientCompanyId) return false;
        if (!normalizedQuery) return true;

        const searchable = [
            project.projectName,
            project.projectId,
            project.location,
            project.startDate,
            project.endDate,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return searchable.includes(normalizedQuery);
    });
}

export function shouldUseScrollableProjectOptions(projects: PlanningProjectDTO[], clientCompanyId: string): boolean {
    return getBillingRateProjectOptions(projects, clientCompanyId).length > 10;
}

function employeeDisplayName(user: UserResponseDTO): string {
    const nameParts = [user.preferredName || user.firstNames, user.middleNamePrefix, user.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

    return nameParts || user.email || user.userId;
}

export function getBillingRateEmployeeOptions(users: UserResponseDTO[], query = ""): UserResponseDTO[] {
    const normalizedQuery = query.trim().toLowerCase();

    return users.filter((user) => {
        if (!normalizedQuery) return true;

        const searchable = [
            employeeDisplayName(user),
            user.email,
            user.userId,
            user.position,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return searchable.includes(normalizedQuery);
    });
}

export function shouldUseScrollableEmployeeOptions(users: UserResponseDTO[]): boolean {
    return getBillingRateEmployeeOptions(users).length > 10;
}

export function getCombinedClientBillingRateRows(
    data: ClientBillingRatesDTO,
    users: UserResponseDTO[]
): CombinedBillingRateRow[] {
    const usersById = new Map(users.map((user) => [user.userId, user]));

    return [
        ...data.defaultRates,
        ...data.projectRates,
        ...data.employeeOverrides,
        ...data.projectEmployeeOverrides,
    ].map((rate) => {
        const user = rate.userId ? usersById.get(rate.userId) : null;

        return {
            ...rate,
            projectLabel: rate.projectId ? rate.projectName || rate.projectId : DEFAULT_PROJECT_LABEL,
            employeeLabel: rate.userId ? (user ? employeeDisplayName(user) : rate.userId) : DEFAULT_EMPLOYEE_LABEL,
        };
    });
}

export function getFilteredClientBillingRateRows(
    rows: CombinedBillingRateRow[],
    filters: BillingRateTableFilters
): CombinedBillingRateRow[] {
    const functionQuery = filters.functionQuery.trim().toLowerCase();
    const projectQuery = filters.projectQuery.trim().toLowerCase();
    const employeeQuery = filters.employeeQuery.trim().toLowerCase();

    return rows.filter((row) => {
        const functionMatch = !functionQuery || row.functionName.toLowerCase().includes(functionQuery);
        const projectMatch = !projectQuery || row.projectLabel.toLowerCase().includes(projectQuery);
        const employeeMatch = !employeeQuery || row.employeeLabel.toLowerCase().includes(employeeQuery);

        return functionMatch && projectMatch && employeeMatch;
    });
}

export function getBillingRateModalKind(
    draft: Pick<UnifiedBillingRateDraft, "defaultForAllProjects" | "defaultForAllEmployees">
): BillingRateModalKind {
    if (draft.defaultForAllProjects && draft.defaultForAllEmployees) return "default";
    if (!draft.defaultForAllProjects && draft.defaultForAllEmployees) return "project";
    if (draft.defaultForAllProjects && !draft.defaultForAllEmployees) return "employee";
    return "projectEmployee";
}

export function createBillingRateDraftFromRow(row: CombinedBillingRateRow): UnifiedBillingRateDraft {
    return {
        editingRateId: row.id,
        functionName: row.functionName,
        ratePerHour: row.ratePerHour,
        projectId: row.projectId ?? "",
        userId: row.userId ?? "",
        effectiveFrom: row.effectiveFrom ?? "",
        effectiveTo: row.effectiveTo ?? "",
        notes: row.notes ?? "",
        defaultForAllProjects: !row.projectId,
        defaultForAllEmployees: !row.userId,
    };
}

export function isUnifiedBillingRateSaveDisabled({
    saving,
    draft,
}: {
    saving: boolean;
    draft: UnifiedBillingRateDraft;
}): boolean {
    const requiresProject = !draft.defaultForAllProjects;
    const requiresEmployee = !draft.defaultForAllEmployees;

    return (
        saving ||
        !draft.functionName.trim() ||
        !draft.ratePerHour ||
        (requiresProject && !draft.projectId) ||
        (requiresEmployee && !draft.userId)
    );
}

function ProjectBillingRatePicker({
    label = "Project",
    projects,
    clientCompanyId,
    value,
    search,
    loading,
    error,
    disabled,
    onSearchChange,
    onSelect,
}: {
    label?: string;
    projects: PlanningProjectDTO[];
    clientCompanyId: string;
    value?: string | null;
    search: string;
    loading: boolean;
    error: string | null;
    disabled: boolean;
    onSearchChange: (value: string) => void;
    onSelect: (project: PlanningProjectDTO) => void;
}) {
    const clientProjects = getBillingRateProjectOptions(projects, clientCompanyId);
    const filteredProjects = getBillingRateProjectOptions(projects, clientCompanyId, search);
    const selectedProject = clientProjects.find((project) => project.projectId === value) ?? null;
    const scrollable = shouldUseScrollableProjectOptions(projects, clientCompanyId);

    return (
        <label className="billingRatesProjectPicker">
            <span>{label}</span>
            <input
                className="modal_input billingRatesProjectSearch"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search projects by name, date, location, or ID"
                disabled={disabled || loading}
                aria-label="Search project billing-rate projects"
            />
            {selectedProject ? (
                <div className="billingRatesProjectSelected">
                    Selected: <strong>{selectedProject.projectName}</strong>
                </div>
            ) : null}
            <div
                className={`billingRatesProjectOptions${scrollable ? " billingRatesProjectOptions--scrollable" : ""}`}
                role="listbox"
                aria-label="Project billing-rate options"
            >
                {loading ? <div className="billingRatesProjectOptionState">Loading projects...</div> : null}
                {!loading && error ? <div className="billingRatesProjectOptionState">{error}</div> : null}
                {!loading && !error && clientProjects.length === 0 ? (
                    <div className="billingRatesProjectOptionState">No projects found for this client.</div>
                ) : null}
                {!loading && !error && clientProjects.length > 0 && filteredProjects.length === 0 ? (
                    <div className="billingRatesProjectOptionState">No matching projects.</div>
                ) : null}
                {!loading && !error
                    ? filteredProjects.map((project) => (
                        <button
                            key={project.projectId}
                            type="button"
                            className={`billingRatesProjectOption${project.projectId === value ? " billingRatesProjectOption--selected" : ""}`}
                            onClick={() => onSelect(project)}
                            disabled={disabled}
                            role="option"
                            aria-selected={project.projectId === value}
                        >
                            <span className="billingRatesProjectOptionName">{project.projectName}</span>
                            <span className="billingRatesProjectOptionMeta">
                                {projectDateRange(project) || project.projectId}
                            </span>
                        </button>
                    ))
                    : null}
            </div>
        </label>
    );
}

function EmployeeBillingRatePicker({
    label = "Employee",
    users,
    value,
    search,
    loading,
    error,
    disabled,
    onSearchChange,
    onSelect,
}: {
    label?: string;
    users: UserResponseDTO[];
    value?: string | null;
    search: string;
    loading: boolean;
    error: string | null;
    disabled: boolean;
    onSearchChange: (value: string) => void;
    onSelect: (user: UserResponseDTO) => void;
}) {
    const filteredUsers = getBillingRateEmployeeOptions(users, search);
    const selectedUser = users.find((user) => user.userId === value) ?? null;
    const scrollable = shouldUseScrollableEmployeeOptions(users);

    return (
        <label className="billingRatesEmployeePicker">
            <span>{label}</span>
            <input
                className="modal_input billingRatesEmployeeSearch"
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search employees by name, email, or ID"
                disabled={disabled || loading}
                aria-label="Search employee billing-rate employees"
            />
            {selectedUser ? (
                <div className="billingRatesProjectSelected">
                    Selected: <strong>{employeeDisplayName(selectedUser)}</strong>
                </div>
            ) : null}
            <div
                className={`billingRatesProjectOptions${scrollable ? " billingRatesProjectOptions--scrollable" : ""}`}
                role="listbox"
                aria-label="Employee billing-rate options"
            >
                {loading ? <div className="billingRatesProjectOptionState">Loading employees...</div> : null}
                {!loading && error ? <div className="billingRatesProjectOptionState">{error}</div> : null}
                {!loading && !error && users.length === 0 ? (
                    <div className="billingRatesProjectOptionState">No employees found.</div>
                ) : null}
                {!loading && !error && users.length > 0 && filteredUsers.length === 0 ? (
                    <div className="billingRatesProjectOptionState">No matching employees.</div>
                ) : null}
                {!loading && !error
                    ? filteredUsers.map((user) => (
                        <button
                            key={user.userId}
                            type="button"
                            className={`billingRatesProjectOption${user.userId === value ? " billingRatesProjectOption--selected" : ""}`}
                            onClick={() => onSelect(user)}
                            disabled={disabled}
                            role="option"
                            aria-selected={user.userId === value}
                        >
                            <span className="billingRatesProjectOptionName">{employeeDisplayName(user)}</span>
                            <span className="billingRatesProjectOptionMeta">{user.email || user.userId}</span>
                        </button>
                    ))
                    : null}
            </div>
        </label>
    );
}

function CombinedBillingRateTable({
    rows,
    allRows,
    filters,
    onFilterChange,
    onEdit,
    onDelete,
}: {
    rows: CombinedBillingRateRow[];
    allRows: CombinedBillingRateRow[];
    filters: BillingRateTableFilters;
    onFilterChange: (filters: BillingRateTableFilters) => void;
    onEdit: (row: CombinedBillingRateRow) => void;
    onDelete: (row: CombinedBillingRateRow) => void;
}) {
    const emptyLabel = "No billing rates";
    const functionOptions = getUniqueBillingRateFilterOptions(allRows.map((row) => row.functionName));
    const projectOptions = getUniqueBillingRateFilterOptions([
        DEFAULT_PROJECT_LABEL,
        ...allRows.map((row) => row.projectLabel),
    ]);
    const employeeOptions = getUniqueBillingRateFilterOptions([
        DEFAULT_EMPLOYEE_LABEL,
        ...allRows.map((row) => row.employeeLabel),
    ]);

    return (
        <div className="listContainer billingRatesListContainer">
            <div className="listHeaderGrid billingRatesGridClient">
                <BillingRateColumnFilter
                    label="Function"
                    value={filters.functionQuery}
                    allLabel="All functions"
                    searchPlaceholder="Search functions"
                    options={functionOptions}
                    variant="header"
                    onChange={(value) => onFilterChange({ ...filters, functionQuery: value })}
                />
                <BillingRateColumnFilter
                    label="Project"
                    value={filters.projectQuery}
                    allLabel="All projects"
                    searchPlaceholder="Search projects"
                    options={projectOptions}
                    variant="header"
                    onChange={(value) => onFilterChange({ ...filters, projectQuery: value })}
                />
                <BillingRateColumnFilter
                    label="Employee"
                    value={filters.employeeQuery}
                    allLabel="All employees"
                    searchPlaceholder="Search employees"
                    options={employeeOptions}
                    variant="header"
                    onChange={(value) => onFilterChange({ ...filters, employeeQuery: value })}
                />
                <span>Rate</span>
                <span>Actions</span>
            </div>
            <div className="listScrollArea billingRatesListScroll">
                {rows.length === 0 ? (
                    <div className="billingRatesEmpty">{emptyLabel}</div>
                ) : (
                    rows.map((row) => (
                        <div
                            className="listRowGrid billingRatesGridClient clickableRow billingRatesRow"
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
                            <span>{row.functionName}</span>
                            <span>{row.projectLabel}</span>
                            <span>{row.employeeLabel}</span>
                            <strong>{money(row.ratePerHour)}</strong>
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
    );
}

export default function AdminPlanningClientBillingRates() {
    const { client } = useOutletContext<ClientDetailOutletContext>();
    const [data, setData] = useState<ClientBillingRatesDTO>(EMPTY_DATA);
    const [projects, setProjects] = useState<PlanningProjectDTO[]>([]);
    const [users, setUsers] = useState<UserResponseDTO[]>([]);
    const [loading, setLoading] = useState(false);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [usersLoading, setUsersLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [projectError, setProjectError] = useState<string | null>(null);
    const [userError, setUserError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [draft, setDraft] = useState<UnifiedBillingRateDraft>(EMPTY_DRAFT);
    const [deleteTarget, setDeleteTarget] = useState<CombinedBillingRateRow | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [projectSearch, setProjectSearch] = useState("");
    const [employeeSearch, setEmployeeSearch] = useState("");
    const [tableFilters, setTableFilters] = useState<BillingRateTableFilters>({
        functionQuery: "",
        projectQuery: "",
        employeeQuery: "",
    });

    async function loadRates() {
        try {
            setLoading(true);
            setProjectsLoading(true);
            setUsersLoading(true);
            setError(null);
            setProjectError(null);
            setUserError(null);
            const [rates, planningProjects, loadedUsers] = await Promise.all([
                UserServices.getClientBillingRates(client.clientCompanyId),
                UserServices.getPlanningOverview(undefined, undefined, { includeAllocationDetails: false }).catch((err: unknown) => {
                    setProjectError(err instanceof Error ? err.message : "Failed to load projects.");
                    return [];
                }),
                UserServices.getUsers().catch((err: unknown) => {
                    setUserError(err instanceof Error ? err.message : "Failed to load employees.");
                    return [];
                }),
            ]);
            setData(rates);
            setProjects(planningProjects);
            setUsers(loadedUsers);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load billing rates.");
        } finally {
            setLoading(false);
            setProjectsLoading(false);
            setUsersLoading(false);
        }
    }

    useEffect(() => {
        void loadRates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [client.clientCompanyId]);

    const combinedRows = useMemo(
        () => getCombinedClientBillingRateRows(data, users),
        [data, users]
    );
    const visibleRows = useMemo(
        () => getFilteredClientBillingRateRows(combinedRows, tableFilters),
        [combinedRows, tableFilters]
    );

    function openCreateModal() {
        setModalOpen(true);
        setSaveError(null);
        setDraft(EMPTY_DRAFT);
        setProjectSearch("");
        setEmployeeSearch("");
    }

    function openEditModal(row: CombinedBillingRateRow) {
        setModalOpen(true);
        setSaveError(null);
        setDraft(createBillingRateDraftFromRow(row));
        setProjectSearch(row.projectId ? row.projectLabel : "");
        setEmployeeSearch(row.userId ? row.employeeLabel : "");
    }

    function openDeletePrompt(row: CombinedBillingRateRow) {
        setDeleteTarget(row);
        setDeleteError(null);
    }

    function closeDeletePrompt() {
        if (deleting) return;
        setDeleteTarget(null);
        setDeleteError(null);
    }

    async function handleDelete() {
        if (!deleteTarget) return;

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

    async function handleSave(event: FormEvent) {
        event.preventDefault();
        const modalKind = getBillingRateModalKind(draft);

        const payload: BillingRateSaveDTO = {
            functionName: draft.functionName.trim(),
            ratePerHour: Number(draft.ratePerHour),
            projectId: draft.defaultForAllProjects ? null : draft.projectId?.trim() || null,
            userId: draft.defaultForAllEmployees ? null : draft.userId?.trim() || null,
            effectiveFrom: modalKind === "default" ? null : draft.effectiveFrom?.trim() || null,
            effectiveTo: draft.effectiveTo?.trim() || null,
            notes: draft.notes?.trim() || null,
        };

        try {
            setSaving(true);
            setSaveError(null);
            if (modalKind === "default") await UserServices.saveClientDefaultBillingRate(client.clientCompanyId, payload);
            if (modalKind === "project") await UserServices.saveProjectBillingRate(client.clientCompanyId, payload);
            if (modalKind === "employee") await UserServices.saveClientEmployeeBillingRate(client.clientCompanyId, payload);
            if (modalKind === "projectEmployee") await UserServices.saveProjectEmployeeBillingRate(client.clientCompanyId, payload);
            setModalOpen(false);
            await loadRates();
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : "Failed to save billing rate.");
        } finally {
            setSaving(false);
        }
    }

    const saveDisabled = isUnifiedBillingRateSaveDisabled({ saving, draft });
    const editing = Boolean(draft.editingRateId);

    return (
        <>
            <Card
                title="Billing rates"
                className="adminUserDetailsPanel adminUserDetailsPanel--wide billingRatesCard billingRatesClientCard"
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
                        <CombinedBillingRateTable
                            rows={visibleRows}
                            allRows={combinedRows}
                            filters={tableFilters}
                            onFilterChange={setTableFilters}
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
                        This removes the selected billing-rate entry. Add a new billing rate if you need this scope again later.
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
                onClose={() => {
                    if (!saving) setModalOpen(false);
                }}
                title={editing ? "Update billing rate" : "Save billing rate"}
                hideDefaultFooter
                maxHeight={640}
            >
                <form className="billingRatesForm" onSubmit={(event) => void handleSave(event)}>
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
                        <input
                            className="modal_input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.ratePerHour || ""}
                            onChange={(event) => setDraft((current) => ({ ...current, ratePerHour: Number(event.target.value) }))}
                            disabled={saving}
                        />
                    </label>
                    <label className="billingRatesCheckboxLabel">
                        <input
                            type="checkbox"
                            checked={draft.defaultForAllProjects}
                            onChange={(event) => {
                                const checked = event.target.checked;
                                setDraft((current) => ({
                                    ...current,
                                    defaultForAllProjects: checked,
                                    projectId: checked ? "" : current.projectId,
                                }));
                                if (checked) setProjectSearch("");
                            }}
                            disabled={saving || editing}
                        />
                        <span>Default for all projects</span>
                        {editing ? (
                            <span
                                className="billingRatesScopeLockHelp"
                                tabIndex={0}
                                aria-label={BILLING_RATE_SCOPE_LOCK_NOTE}
                            >
                                ?
                                <span className="billingRatesScopeLockHelpText">{BILLING_RATE_SCOPE_LOCK_NOTE}</span>
                            </span>
                        ) : null}
                    </label>
                    {!draft.defaultForAllProjects ? (
                        <ProjectBillingRatePicker
                            projects={projects}
                            clientCompanyId={client.clientCompanyId}
                            value={draft.projectId}
                            search={projectSearch}
                            loading={projectsLoading}
                            error={projectError}
                            disabled={saving || editing}
                            onSearchChange={setProjectSearch}
                            onSelect={(project) => {
                                setDraft((current) => ({ ...current, projectId: project.projectId }));
                                setProjectSearch(project.projectName);
                            }}
                        />
                    ) : null}
                    <label className="billingRatesCheckboxLabel">
                        <input
                            type="checkbox"
                            checked={draft.defaultForAllEmployees}
                            onChange={(event) => {
                                const checked = event.target.checked;
                                setDraft((current) => ({
                                    ...current,
                                    defaultForAllEmployees: checked,
                                    userId: checked ? "" : current.userId,
                                }));
                                if (checked) setEmployeeSearch("");
                            }}
                            disabled={saving || editing}
                        />
                        <span>Default for all employees</span>
                        {editing ? (
                            <span
                                className="billingRatesScopeLockHelp"
                                tabIndex={0}
                                aria-label={BILLING_RATE_SCOPE_LOCK_NOTE}
                            >
                                ?
                                <span className="billingRatesScopeLockHelpText">{BILLING_RATE_SCOPE_LOCK_NOTE}</span>
                            </span>
                        ) : null}
                    </label>
                    {!draft.defaultForAllEmployees ? (
                        <EmployeeBillingRatePicker
                            users={users}
                            value={draft.userId}
                            search={employeeSearch}
                            loading={usersLoading}
                            error={userError}
                            disabled={saving || editing}
                            onSearchChange={setEmployeeSearch}
                            onSelect={(user) => {
                                setDraft((current) => ({ ...current, userId: user.userId }));
                                setEmployeeSearch(employeeDisplayName(user));
                            }}
                        />
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
                        <button type="button" className="buttonSecondary" onClick={() => setModalOpen(false)} disabled={saving}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="button"
                            disabled={saveDisabled}
                        >
                            {saving ? "Saving..." : editing ? "Update billing rate" : "Save billing rate"}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
