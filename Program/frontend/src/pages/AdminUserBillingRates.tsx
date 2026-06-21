import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import BillingRateColumnFilter from "../components/common/BillingRateColumnFilter";
import Card from "../components/common/Card";
import {
    UserServices,
    type BillingRateDTO,
    type UserBillingRatesDTO,
} from "../services/user-service/UserServices";
import { billingRateFilterMatches, getUniqueBillingRateFilterOptions } from "../utils/billingRateFilters";
import { billingRateScopeLabel, billingRateSectionCountLabel } from "../utils/billingRates";
import "../stylesheets/AdminPlanningClients.css";

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

const EMPTY_FILTERS: UserBillingRateFilters = {
    clientQuery: "",
    projectQuery: "",
    functionQuery: "",
    scopeQuery: "",
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

function RateList({ title, rows, emptyLabel }: { title: string; rows: BillingRateDTO[]; emptyLabel: string }) {
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
            <div className="billingRatesTable billingRatesTable--user">
                <div className="billingRatesHeader">
                    <span>Client</span>
                    <span>Project</span>
                    <span>Function</span>
                    <span>Rate</span>
                    <span>Scope</span>
                </div>
                <div className="billingRatesFilterRow">
                    <BillingRateColumnFilter
                        label="Client"
                        value={filters.clientQuery}
                        allLabel="All clients"
                        searchPlaceholder="Search clients"
                        options={clientOptions}
                        onChange={(value) => setFilters((current) => ({ ...current, clientQuery: value }))}
                    />
                    <BillingRateColumnFilter
                        label="Project"
                        value={filters.projectQuery}
                        allLabel="All projects"
                        searchPlaceholder="Search projects"
                        options={projectOptions}
                        onChange={(value) => setFilters((current) => ({ ...current, projectQuery: value }))}
                    />
                    <BillingRateColumnFilter
                        label="Function"
                        value={filters.functionQuery}
                        allLabel="All functions"
                        searchPlaceholder="Search functions"
                        options={functionOptions}
                        onChange={(value) => setFilters((current) => ({ ...current, functionQuery: value }))}
                    />
                    <span className="billingRatesFilterPlaceholder">-</span>
                    <BillingRateColumnFilter
                        label="Scope"
                        value={filters.scopeQuery}
                        allLabel="All scopes"
                        searchPlaceholder="Search scopes"
                        options={scopeOptions}
                        onChange={(value) => setFilters((current) => ({ ...current, scopeQuery: value }))}
                    />
                </div>
                {visibleRows.length === 0 ? (
                    <div className="billingRatesEmpty">{emptyLabel}</div>
                ) : (
                    visibleRows.map((row) => (
                        <div className="billingRatesRow" key={`${row.scope}-${row.id}`}>
                            <span>{clientLabel(row)}</span>
                            <span>{projectLabel(row)}</span>
                            <span>{row.functionName}</span>
                            <strong>{money(row.ratePerHour)}</strong>
                            <span>{scopeLabel(row)}</span>
                        </div>
                    ))
                )}
            </div>
        </section>
    );
}

export default function AdminUserBillingRates() {
    const { userId } = useParams<{ userId: string }>();
    const [data, setData] = useState<UserBillingRatesDTO>(EMPTY_DATA);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

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

    return (
        <section className="adminUserDetailsTabPanel">
            <Card title="Billing rates" className="adminUserDetailsPanel adminUserDetailsPanel--wide billingRatesCard">
                {loading ? <div className="billingRatesState">Loading billing rates...</div> : null}
                {error ? <div className="workHistoryError">{error}</div> : null}
                {!loading && !error ? (
                    <div className="billingRatesLayout">
                        <RateList
                            title="Client-level overrides"
                            rows={data.clientOverrides}
                            emptyLabel="No client-level overrides"
                        />
                        <RateList
                            title="Project-level overrides"
                            rows={data.projectOverrides}
                            emptyLabel="No project-level overrides"
                        />
                    </div>
                ) : null}
            </Card>
        </section>
    );
}
