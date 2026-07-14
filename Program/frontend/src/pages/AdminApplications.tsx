import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { FilterPanelBody, FilterToggleButton } from "../components/common/FilterPanel";
import type { FilterFieldConfig } from "../components/common/FilterPanel.types";
import { useFilterPanel } from "../components/common/useFilterPanel";
import { applyFilterRows, dateFromAtLeast, dateToAtMost, textIncludes } from "../utils/applyFilterRows";
import { UserServices, type JobApplicationResponseDTO } from "../services/user-service/UserServices";
import { formatDateTime } from "../utils/dateFormat";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminApplications.css";

export type ApplicationDecisionState = {
    note: string;
    loading: boolean;
    message: string | null;
    error: string | null;
};

export function applicationFullName(application: JobApplicationResponseDTO): string {
    const parts = [application.firstNames, application.middleNamePrefix, application.lastName]
        .map((part) => (part ?? "").trim())
        .filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    const preferred = (application.preferredName ?? "").trim();
    return preferred || application.email;
}

export function applicationStatusLabel(status?: string | null): string {
    const normalized = (status ?? "").toUpperCase();
    if (normalized === "APPLICATION_SUBMITTED") return "Applied";
    if (normalized === "APPLICATION_ACCEPTED") return "Accepted";
    if (normalized === "APPLICATION_DENIED") return "Denied";
    return status ?? "-";
}

export function applicationStatusClass(status?: string | null): string {
    const normalized = (status ?? "").toUpperCase();
    if (normalized === "APPLICATION_ACCEPTED") return "cellOk";
    if (normalized === "APPLICATION_DENIED") return "cellBad";
    if (normalized === "APPLICATION_SUBMITTED") return "cellWarn";
    return "cellSub";
}

const FILTER_FIELDS: FilterFieldConfig[] = [
    {
        field: "search",
        label: "Search",
        section: "Identity",
        placeholder: "Name or email",
        kind: { kind: "search" },
    },
    {
        field: "email",
        label: "Email",
        section: "Identity",
        kind: { kind: "text" },
    },
    {
        field: "roleInterest",
        label: "Role interest",
        section: "Job",
        kind: { kind: "text" },
    },
    {
        field: "contractPreference",
        label: "Contract preference",
        section: "Job",
        kind: { kind: "text" },
    },
    {
        field: "status",
        label: "Status",
        section: "Status",
        kind: {
            kind: "select",
            options: [
                { value: "APPLICATION_SUBMITTED", label: "Applied" },
                { value: "APPLICATION_DENIED", label: "Denied" },
            ],
            emptyLabel: "Any status",
        },
    },
    {
        field: "dateFrom",
        label: "Submitted from",
        section: "Dates",
        placeholder: "dd/mm/yyyy",
        maxLength: 10,
        kind: { kind: "date" },
    },
    {
        field: "dateTo",
        label: "Submitted to",
        section: "Dates",
        placeholder: "dd/mm/yyyy",
        maxLength: 10,
        kind: { kind: "date" },
    },
];

type AdminApplicationQueueProps = {
    applications: JobApplicationResponseDTO[];
    loading: boolean;
    error: string | null;
    /** @deprecated kept for backwards compatibility; refresh control was removed in favour of the filter panel. */
    onRefresh?: () => void;
};

export function AdminApplicationQueue({
    applications,
    loading,
    error,
}: AdminApplicationQueueProps) {
    const filter = useFilterPanel({ fields: FILTER_FIELDS });

    const sortedApplications = useMemo(() => {
        // Accepted applicants have graduated to the Users list as "Onboarding"; drop them here
        // so this queue only shows applications still awaiting (or refused at) the apply stage.
        const visible = applications.filter(
            (application) => (application.status ?? "").toUpperCase() !== "APPLICATION_ACCEPTED"
        );
        const sorted = [...visible].sort((left, right) => {
            return (right.submittedAt ?? "").localeCompare(left.submittedAt ?? "");
        });
        return applyFilterRows(sorted, filter.rows, {
            search: (application, value) =>
                textIncludes(applicationFullName(application), value) ||
                textIncludes(application.email, value),
            email: (application, value) => textIncludes(application.email, value),
            roleInterest: (application, value) => textIncludes(application.roleInterest, value),
            contractPreference: (application, value) =>
                textIncludes(application.contractPreference, value),
            status: (application, value) =>
                (application.status ?? "").toUpperCase() === value.toUpperCase(),
            dateFrom: (application, value) => dateFromAtLeast(application.submittedAt, value),
            dateTo: (application, value) => dateToAtMost(application.submittedAt, value),
        });
    }, [applications, filter.rows]);

    return (
        <Card
            title="Application review queue"
            right={
                <div className="applicationsToolbar">
                    <div className="applicationsCount">
                        {sortedApplications.length} application{sortedApplications.length === 1 ? "" : "s"}
                    </div>
                    <FilterToggleButton controller={filter} />
                </div>
            }
        >
            <FilterPanelBody
                controller={filter}
                resultMeta={`${sortedApplications.length} application${sortedApplications.length === 1 ? "" : "s"}`}
            />
            <div className="listContainer applicationsListContainer">
                <div className="listHeaderGrid gridApplications">
                    <div>Applicant</div>
                    <div>Contact</div>
                    <div>Role interest</div>
                    <div>Contract</div>
                    <div>Submitted</div>
                    <div>Status</div>
                </div>
                <div className="listScrollArea applicationsScroll">
                    {loading ? <div className="listEmpty">Loading applications...</div> : null}
                    {error ? <div className="listEmpty errorText">{error}</div> : null}
                    {!loading && !error && sortedApplications.length === 0 ? (
                        <div className="listEmpty">
                            No submitted applications are waiting for review.
                        </div>
                    ) : null}
                    {!loading && !error
                        ? sortedApplications.map((application) => (
                              <Link
                                  key={application.applicationId}
                                  className="listRowGrid gridApplications clickableRow applicationRow"
                                  to={`/management/applications/${application.applicationId}`}
                              >
                                  <div>
                                      <div className="cellMain">{applicationFullName(application)}</div>
                                      <div className="cellSub">{application.applicationId}</div>
                                  </div>
                                  <div className="cellSub applicationContactCell" data-label="Contact">
                                      <span>{application.email}</span>
                                      <span>{application.phoneNumber}</span>
                                  </div>
                                  <div className="cellSub" data-label="Role interest">{application.roleInterest || "-"}</div>
                                  <div className="cellSub" data-label="Contract">{application.contractPreference || "-"}</div>
                                  <div className="cellSub" data-label="Submitted">{formatDateTime(application.submittedAt)}</div>
                                  <div className={applicationStatusClass(application.status)} data-label="Status">
                                      {applicationStatusLabel(application.status)}
                                  </div>
                              </Link>
                          ))
                        : null}
                </div>
            </div>
        </Card>
    );
}

export default function AdminApplications() {
    const [applications, setApplications] = useState<JobApplicationResponseDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadApplications = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getApplications();
            setApplications(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load applications.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadApplications();
    }, [loadApplications]);

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <main className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/management" />
                            <h1 className="pageTitle">Applications</h1>
                            <p className="pageSubtitle">
                                Review public job applications and decide the next step.
                            </p>
                        </header>
                        <div className="adminDashboardCard">
                            <AdminApplicationQueue
                                applications={applications}
                                loading={loading}
                                error={error}
                            />
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}
