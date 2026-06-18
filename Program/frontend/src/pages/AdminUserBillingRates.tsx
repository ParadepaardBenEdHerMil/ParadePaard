import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Card from "../components/common/Card";
import {
    UserServices,
    type BillingRateDTO,
    type UserBillingRatesDTO,
} from "../services/user-service/UserServices";
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

function money(value?: number | null): string {
    return value == null ? "-" : `${currencyFormatter.format(value)}/h`;
}

function RateList({ title, rows, emptyLabel }: { title: string; rows: BillingRateDTO[]; emptyLabel: string }) {
    return (
        <section className="billingRatesSection">
            <div className="billingRatesSectionHeader">
                <h3>{title}</h3>
                <span>{billingRateSectionCountLabel({ visible: rows.length, total: rows.length, emptyLabel })}</span>
            </div>
            <div className="billingRatesTable billingRatesTable--user">
                <div className="billingRatesHeader">
                    <span>Client</span>
                    <span>Project</span>
                    <span>Function</span>
                    <span>Rate</span>
                    <span>Scope</span>
                </div>
                {rows.length === 0 ? (
                    <div className="billingRatesEmpty">{emptyLabel}</div>
                ) : (
                    rows.map((row) => (
                        <div className="billingRatesRow" key={`${row.scope}-${row.id}`}>
                            <span>{row.clientName || "-"}</span>
                            <span>{row.projectName || "-"}</span>
                            <span>{row.functionName}</span>
                            <strong>{money(row.ratePerHour)}</strong>
                            <span>{billingRateScopeLabel(row.scope)}</span>
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
