import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useOutletContext } from "react-router-dom";
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
import { billingRateScopeLabel, billingRateSectionCountLabel } from "../utils/billingRates";
import type { ClientDetailOutletContext } from "./AdminPlanningClientDetail";

const EMPTY_DATA: ClientBillingRatesDTO = {
    defaultRates: [],
    projectRates: [],
    employeeOverrides: [],
    projectEmployeeOverrides: [],
};

const EMPTY_DRAFT: BillingRateSaveDTO = {
    functionName: "",
    ratePerHour: 0,
    projectId: "",
    userId: "",
    effectiveFrom: "",
    effectiveTo: "",
    notes: "",
};

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

function BillingRateTable({
    title,
    emptyLabel,
    rows,
    children,
}: {
    title: string;
    emptyLabel: string;
    rows: BillingRateDTO[];
    children?: ReactNode;
}) {
    return (
        <section className="billingRatesSection">
            <div className="billingRatesSectionHeader">
                <h3>{title}</h3>
                <span>{billingRateSectionCountLabel({ visible: rows.length, total: rows.length, emptyLabel })}</span>
            </div>
            {children}
            <div className="billingRatesTable">
                <div className="billingRatesHeader">
                    <span>Function</span>
                    <span>Rate</span>
                    <span>Scope</span>
                    <span>Project</span>
                    <span>Active from</span>
                    <span>Notes</span>
                </div>
                {rows.length === 0 ? (
                    <div className="billingRatesEmpty">{emptyLabel}</div>
                ) : (
                    rows.map((row) => (
                        <div className="billingRatesRow" key={`${row.scope}-${row.id}`}>
                            <span>{row.functionName}</span>
                            <strong>{money(row.ratePerHour)}</strong>
                            <span>{billingRateScopeLabel(row.scope)}</span>
                            <span>{row.projectName || "-"}</span>
                            <span>{dateLabel(row.effectiveFrom)}</span>
                            <span>{row.notes || "-"}</span>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
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

export function getProjectBillingRatesForProject(
    rates: BillingRateDTO[],
    selectedProjectId: string | null | undefined
): BillingRateDTO[] {
    if (!selectedProjectId) return rates;
    return rates.filter((rate) => rate.projectId === selectedProjectId);
}

export function getEmployeeBillingRatesForEmployee(
    rates: BillingRateDTO[],
    selectedUserId: string | null | undefined
): BillingRateDTO[] {
    if (!selectedUserId) return rates;
    return rates.filter((rate) => rate.userId === selectedUserId);
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
    const [modalKind, setModalKind] = useState<"default" | "project" | "employee" | "projectEmployee" | null>(null);
    const [draft, setDraft] = useState<BillingRateSaveDTO>(EMPTY_DRAFT);
    const [projectSearch, setProjectSearch] = useState("");
    const [projectRatesSearch, setProjectRatesSearch] = useState("");
    const [selectedProjectRatesProjectId, setSelectedProjectRatesProjectId] = useState<string | null>(null);
    const [employeeOverridesSearch, setEmployeeOverridesSearch] = useState("");
    const [selectedEmployeeOverridesUserId, setSelectedEmployeeOverridesUserId] = useState<string | null>(null);

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

    const combinedEmployeeOverrides = useMemo(
        () => [...data.employeeOverrides, ...data.projectEmployeeOverrides],
        [data.employeeOverrides, data.projectEmployeeOverrides]
    );
    const visibleEmployeeOverrides = useMemo(
        () => getEmployeeBillingRatesForEmployee(combinedEmployeeOverrides, selectedEmployeeOverridesUserId),
        [combinedEmployeeOverrides, selectedEmployeeOverridesUserId]
    );

    function openModal(kind: "default" | "project" | "employee" | "projectEmployee") {
        setModalKind(kind);
        setSaveError(null);
        setDraft(EMPTY_DRAFT);
        setProjectSearch("");
    }

    async function handleSave(event: FormEvent) {
        event.preventDefault();
        if (!modalKind) return;

        const payload: BillingRateSaveDTO = {
            ...draft,
            functionName: draft.functionName.trim(),
            projectId: draft.projectId?.trim() || null,
            userId: draft.userId?.trim() || null,
            effectiveFrom: draft.effectiveFrom?.trim() || null,
            effectiveTo: draft.effectiveTo?.trim() || null,
            notes: draft.notes?.trim() || null,
            ratePerHour: Number(draft.ratePerHour),
        };

        try {
            setSaving(true);
            setSaveError(null);
            if (modalKind === "default") await UserServices.saveClientDefaultBillingRate(client.clientCompanyId, payload);
            if (modalKind === "project") await UserServices.saveProjectBillingRate(client.clientCompanyId, payload);
            if (modalKind === "employee") await UserServices.saveClientEmployeeBillingRate(client.clientCompanyId, payload);
            if (modalKind === "projectEmployee") await UserServices.saveProjectEmployeeBillingRate(client.clientCompanyId, payload);
            setModalKind(null);
            await loadRates();
        } catch (err: unknown) {
            setSaveError(err instanceof Error ? err.message : "Failed to save billing rate.");
        } finally {
            setSaving(false);
        }
    }

    const modalRequiresProject = modalKind === "project" || modalKind === "projectEmployee";
    const visibleProjectRates = getProjectBillingRatesForProject(data.projectRates, selectedProjectRatesProjectId);

    return (
        <>
            <Card
                title="Billing rates"
                className="adminUserDetailsPanel adminUserDetailsPanel--wide billingRatesCard"
                right={
                    <div className="adminUsersToolbar billingRatesToolbar">
                        <button type="button" className="button" onClick={() => openModal("default")}>
                            Add default
                        </button>
                        <button type="button" className="buttonSecondary" onClick={() => openModal("project")}>
                            Add project rate
                        </button>
                        <button type="button" className="buttonSecondary" onClick={() => openModal("employee")}>
                            Add employee override
                        </button>
                    </div>
                }
            >
                {loading ? <div className="billingRatesState">Loading billing rates...</div> : null}
                {error ? <div className="workHistoryError">{error}</div> : null}
                {!loading && !error ? (
                    <div className="billingRatesLayout">
                        <BillingRateTable
                            title="Default billing rates"
                            emptyLabel="No default billing rates"
                            rows={data.defaultRates}
                        />
                        <BillingRateTable
                            title="Project billing rates"
                            emptyLabel="No project billing rates"
                            rows={visibleProjectRates}
                        >
                            <div className="billingRatesProjectSectionControls">
                                <ProjectBillingRatePicker
                                    label="Choose project"
                                    projects={projects}
                                    clientCompanyId={client.clientCompanyId}
                                    value={selectedProjectRatesProjectId}
                                    search={projectRatesSearch}
                                    loading={projectsLoading}
                                    error={projectError}
                                    disabled={false}
                                    onSearchChange={(value) => {
                                        setProjectRatesSearch(value);
                                        if (!value.trim()) setSelectedProjectRatesProjectId(null);
                                    }}
                                    onSelect={(project) => {
                                        setSelectedProjectRatesProjectId(project.projectId);
                                        setProjectRatesSearch(project.projectName);
                                    }}
                                />
                            </div>
                        </BillingRateTable>
                        <BillingRateTable
                            title="Employee overrides"
                            emptyLabel="No employee overrides"
                            rows={visibleEmployeeOverrides}
                        >
                            <div className="billingRatesEmployeeSectionControls">
                                <EmployeeBillingRatePicker
                                    label="Choose employee"
                                    users={users}
                                    value={selectedEmployeeOverridesUserId}
                                    search={employeeOverridesSearch}
                                    loading={usersLoading}
                                    error={userError}
                                    disabled={false}
                                    onSearchChange={(value) => {
                                        setEmployeeOverridesSearch(value);
                                        if (!value.trim()) setSelectedEmployeeOverridesUserId(null);
                                    }}
                                    onSelect={(user) => {
                                        setSelectedEmployeeOverridesUserId(user.userId);
                                        setEmployeeOverridesSearch(employeeDisplayName(user));
                                    }}
                                />
                            </div>
                        </BillingRateTable>
                    </div>
                ) : null}
            </Card>

            <Modal
                open={modalKind !== null}
                onClose={() => {
                    if (!saving) setModalKind(null);
                }}
                title="Save billing rate"
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
                            disabled={saving}
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
                    {modalKind === "project" || modalKind === "projectEmployee" ? (
                        <ProjectBillingRatePicker
                            projects={projects}
                            clientCompanyId={client.clientCompanyId}
                            value={draft.projectId}
                            search={projectSearch}
                            loading={projectsLoading}
                            error={projectError}
                            disabled={saving}
                            onSearchChange={setProjectSearch}
                            onSelect={(project) => {
                                setDraft((current) => ({ ...current, projectId: project.projectId }));
                                setProjectSearch(project.projectName);
                            }}
                        />
                    ) : null}
                    {modalKind === "employee" || modalKind === "projectEmployee" ? (
                        <label>
                            <span>Employee ID</span>
                            <input
                                className="modal_input"
                                value={draft.userId ?? ""}
                                onChange={(event) => setDraft((current) => ({ ...current, userId: event.target.value }))}
                                disabled={saving}
                            />
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
                        <button type="button" className="buttonSecondary" onClick={() => setModalKind(null)} disabled={saving}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="button"
                            disabled={saving || !draft.functionName.trim() || !draft.ratePerHour || (modalRequiresProject && !draft.projectId)}
                        >
                            {saving ? "Saving..." : "Save billing rate"}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
