import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useOutletContext } from "react-router-dom";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import {
    UserServices,
    type BillingRateDTO,
    type BillingRateSaveDTO,
    type ClientBillingRatesDTO,
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
}: {
    title: string;
    emptyLabel: string;
    rows: BillingRateDTO[];
}) {
    return (
        <section className="billingRatesSection">
            <div className="billingRatesSectionHeader">
                <h3>{title}</h3>
                <span>{billingRateSectionCountLabel({ visible: rows.length, total: rows.length, emptyLabel })}</span>
            </div>
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

export default function AdminPlanningClientBillingRates() {
    const { client } = useOutletContext<ClientDetailOutletContext>();
    const [data, setData] = useState<ClientBillingRatesDTO>(EMPTY_DATA);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [modalKind, setModalKind] = useState<"default" | "project" | "employee" | "projectEmployee" | null>(null);
    const [draft, setDraft] = useState<BillingRateSaveDTO>(EMPTY_DRAFT);

    async function loadRates() {
        try {
            setLoading(true);
            setError(null);
            setData(await UserServices.getClientBillingRates(client.clientCompanyId));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load billing rates.");
        } finally {
            setLoading(false);
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

    function openModal(kind: "default" | "project" | "employee" | "projectEmployee") {
        setModalKind(kind);
        setSaveError(null);
        setDraft(EMPTY_DRAFT);
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

    return (
        <>
            <Card
                title="Billing rates"
                className="adminUserDetailsPanel adminUserDetailsPanel--wide"
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
                            rows={data.projectRates}
                        />
                        <BillingRateTable
                            title="Employee overrides"
                            emptyLabel="No employee overrides"
                            rows={combinedEmployeeOverrides}
                        />
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
                        <label>
                            <span>Project ID</span>
                            <input
                                className="modal_input"
                                value={draft.projectId ?? ""}
                                onChange={(event) => setDraft((current) => ({ ...current, projectId: event.target.value }))}
                                disabled={saving}
                            />
                        </label>
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
                        <button type="submit" className="button" disabled={saving || !draft.functionName.trim() || !draft.ratePerHour}>
                            {saving ? "Saving..." : "Save billing rate"}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
