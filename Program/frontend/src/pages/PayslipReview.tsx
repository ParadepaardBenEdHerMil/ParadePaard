import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { FilterPanelBody, FilterToggleButton } from "../components/common/FilterPanel";
import PageToolsMenu from "../components/common/PageToolsMenu";
import type { FilterFieldConfig } from "../components/common/FilterPanel.types";
import { useFilterPanel } from "../components/common/useFilterPanel";
import { applyFilterRows, dateFromAtLeast, dateToAtMost, parseFilterNumber, textIncludes } from "../utils/applyFilterRows";
import { UserServices, type PayslipResponseDTO } from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/Payslips.css";

const FILTER_FIELDS: FilterFieldConfig[] = [
    {
        field: "search",
        label: "Search",
        section: "Identity",
        placeholder: "Employee name",
        kind: { kind: "search" },
    },
    {
        field: "name",
        label: "Employee name",
        section: "Identity",
        kind: { kind: "text" },
    },
    {
        field: "status",
        label: "Status",
        section: "Status",
        kind: { kind: "text" },
    },
    {
        field: "dateFrom",
        label: "Period from",
        section: "Dates",
        placeholder: "dd/mm/yyyy",
        maxLength: 10,
        kind: { kind: "date" },
    },
    {
        field: "dateTo",
        label: "Period to",
        section: "Dates",
        placeholder: "dd/mm/yyyy",
        maxLength: 10,
        kind: { kind: "date" },
    },
    {
        field: "minHours",
        label: "Min hours",
        section: "Hours",
        placeholder: "0",
        kind: { kind: "decimal" },
    },
    {
        field: "maxHours",
        label: "Max hours",
        section: "Hours",
        placeholder: "60",
        kind: { kind: "decimal" },
    },
    {
        field: "minNet",
        label: "Min net pay",
        section: "Pay",
        placeholder: "0",
        kind: { kind: "decimal" },
    },
    {
        field: "maxNet",
        label: "Max net pay",
        section: "Pay",
        placeholder: "5000",
        kind: { kind: "decimal" },
    },
];

export default function PayslipReview() {
    const navigate = useNavigate();
    const [payslips, setPayslips] = useState<PayslipResponseDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const filter = useFilterPanel({ fields: FILTER_FIELDS });

    const normalizeStatus = (status?: string | null) => (status ?? "RELEASED").toUpperCase();
    const formatStatus = (status?: string | null) => {
        const value = normalizeStatus(status);
        return value
            .split("_")
            .map((part) => part[0] + part.slice(1).toLowerCase())
            .join(" ");
    };

    const money = (n: number | null | undefined) =>
        new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(n ?? 0));

    const downloadPayslipPdf = async (payslipId: string, filename: string) => {
        const blob = await UserServices.getPayslipPdf(payslipId);
        const url = URL.createObjectURL(blob);
        try {
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            a.remove();
        } finally {
            URL.revokeObjectURL(url);
        }
    };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getPayslipsForReview();
            setPayslips(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load payslips for review");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const sorted = useMemo(() => {
        const sortedAll = [...payslips].sort((a, b) => {
            const da = a.availableToUserAt ?? "";
            const db = b.availableToUserAt ?? "";
            if (da !== db) return da.localeCompare(db);
            return (a.name ?? "").localeCompare(b.name ?? "");
        });
        return applyFilterRows(sortedAll, filter.rows, {
            search: (p, value) => textIncludes(p.name ?? "", value),
            name: (p, value) => textIncludes(p.name ?? "", value),
            status: (p, value) => textIncludes(formatStatus(p.status), value),
            dateFrom: (p, value) => dateFromAtLeast(p.dateOfIssue, value),
            dateTo: (p, value) => dateToAtMost(p.dateOfIssue, value),
            minHours: (p, value) => {
                const target = parseFilterNumber(value);
                return target === null || Number(p.totalHoursWorked ?? 0) >= target;
            },
            maxHours: (p, value) => {
                const target = parseFilterNumber(value);
                return target === null || Number(p.totalHoursWorked ?? 0) <= target;
            },
            minNet: (p, value) => {
                const target = parseFilterNumber(value);
                return target === null || Number(p.totalNetAmount ?? 0) >= target;
            },
            maxNet: (p, value) => {
                const target = parseFilterNumber(value);
                return target === null || Number(p.totalNetAmount ?? 0) <= target;
            },
        });
    }, [filter.rows, payslips]);

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/management" />
                            <h1 className="pageTitle">Payslip Review</h1>
                        </header>
                        <div className="adminDashboardCard">
                            <Card
                                title="Pending Review"
                                right={
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <PageToolsMenu
                                            exportAction={{
                                                filename: "payslip-review",
                                                build: () => [
                                                    ["Name", "Period end", "Payout", "Hours", "Net", "Status"],
                                                    ...sorted.map((p) => [
                                                        p.name ?? "",
                                                        p.dateOfIssue ? formatDate(p.dateOfIssue) : "",
                                                        p.availableToUserAt ? formatDate(p.availableToUserAt) : "",
                                                        Number(p.totalHoursWorked ?? 0).toFixed(2),
                                                        money(p.totalNetAmount),
                                                        formatStatus(p.status),
                                                    ]),
                                                ],
                                            }}
                                        />
                                        <FilterToggleButton controller={filter} />
                                    </div>
                                }
                            >
                                <FilterPanelBody
                                    controller={filter}
                                    resultMeta={`${sorted.length} pending review`}
                                />
                                <div className="listContainer">
                                    <div className="listHeaderGrid gridPayslipReview">
                                        <div>Name</div>
                                        <div>Period end</div>
                                        <div>Payout</div>
                                        <div>Hours</div>
                                        <div>Net</div>
                                        <div>Status</div>
                                        <div>Action</div>
                                    </div>

                                    <div className="listScrollArea">
                                        {loading ? <div className="listEmpty">Loading...</div> : null}
                                        {error ? <div className="listEmpty errorText">{error}</div> : null}

                                        {!loading && !error && sorted.length === 0 ? (
                                            <div className="listEmpty">No payslips pending review</div>
                                        ) : null}

                                        {!loading && !error
                                            ? sorted.map((p) => (
                                                  <div
                                                      key={p.payslipId}
                                                      className="listRowGrid gridPayslipReview clickableRow"
                                                      onClick={() => navigate(`/management/payslips/${p.payslipId}`)}
                                                  >
                                                      <div className="cellMain">{p.name}</div>
                                                      <div className="cellSub" data-label="Period end">{formatDate(p.dateOfIssue)}</div>
                                                      <div className="cellSub" data-label="Payout">{formatDate(p.availableToUserAt)}</div>
                                                      <div className="cellDate" data-label="Hours">
                                                          {Number(p.totalHoursWorked ?? 0).toFixed(2)}
                                                      </div>
                                                      <div className="cellDate" data-label="Net">{money(p.totalNetAmount)}</div>
                                                      <div className="cellSub" data-label="Status">{formatStatus(p.status)}</div>
                                                      <div className="cellDate" data-label="">
                                                          <button
                                                              className="linkButton"
                                                              type="button"
                                                              onClick={(event) => {
                                                                  event.stopPropagation();
                                                                  void downloadPayslipPdf(
                                                                      p.payslipId,
                                                                      `payslip_review_${p.weekBasedYear}_W${p.weekNumber}.pdf`
                                                                  );
                                                              }}
                                                          >
                                                              Download PDF
                                                          </button>
                                                      </div>
                                                  </div>
                                              ))
                                            : null}
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
