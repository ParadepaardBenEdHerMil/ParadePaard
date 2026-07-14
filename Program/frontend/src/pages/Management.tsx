import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { useAuth } from "../context/AuthContext";
import {
    APPLICATION_REVIEW_PERMISSIONS,
    FINANCE_NAV_LABELS,
    ONBOARDING_REVIEW_PERMISSIONS,
    getManagementNavItems,
    hasAnyPermission,
} from "../utils/permissionPolicy";
import { buildManagementSections } from "../utils/managementSections";
import { UserServices } from "../services/user-service/UserServices";
import "../stylesheets/Management.css";

// Labels of cards that show a pending-work counter badge.
const BADGE_LABELS = new Set([
    "Travel claims",
    "Applications",
    "Onboarding review",
    "Payslip review",
    "Finance",
]);

// User statuses that mean a profile is sitting in the onboarding review queue.
const ONBOARDING_REVIEW_STATUSES = new Set([
    "PENDING_PROFILE_REVIEW",
    "CHANGES_REQUESTED",
    "PENDING_CONTRACT_SIGNATURE",
    "PENDING_CONTRACT_REVIEW",
]);

type PendingCounts = {
    travelClaims: number;
    applications: number;
    onboardingReview: number;
    payslipReview: number;
};

const EMPTY_COUNTS: PendingCounts = {
    travelClaims: 0,
    applications: 0,
    onboardingReview: 0,
    payslipReview: 0,
};

function formatBadgeCount(value: number): string {
    return value > 99 ? "99+" : String(value);
}

const cardDetails: Record<string, { description: string; meta: string }> = {
    Users: {
        description: "Open the employee directory, inspect profiles, and review access details.",
        meta: "Employee directory",
    },
    Applications: {
        description: "Review public job applications and accept or deny applicants.",
        meta: "Application review",
    },
    "Onboarding review": {
        description: "Review employee setup progress and open profiles that need management attention.",
        meta: "Review queue",
    },
    Contracts: {
        description: "View employee contracts by status and open the related employee profile.",
        meta: "Contract workspace",
    },
    Planning: {
        description: "Create projects, build shifts, and schedule people into work.",
        meta: "Projects and shifts",
    },
    Clients: {
        description: "Manage client companies, contacts, addresses, and planning notes.",
        meta: "Planning contacts",
    },
    Locations: {
        description: "Manage reusable planning locations and prioritize them around client work history.",
        meta: "Location library",
    },
    "Email presets": {
        description: "Write reusable email templates for shifts, projects, users, and application/onboarding decisions.",
        meta: "Email templates",
    },
    "Travel claims": {
        description: "Review submitted travel claims and approve or reject expenses.",
        meta: "Expense review",
    },
    "Work history": {
        description: "View all worked shifts, filter the history, and choose saved table columns.",
        meta: "Company history",
    },
    "All payslips": {
        description: "Inspect company payslips by employee, date, week, and status.",
        meta: "Company payroll",
    },
    "Payslip review": {
        description: "Open the payroll review queue for payslips that need attention.",
        meta: "Review queue",
    },
    "Payroll Finance": {
        description: "View shift billing, employer costs, client charges, and payroll margin.",
        meta: "Internal finance",
    },
    Finance: {
        description: "Payslips, work history, travel claims, the review queue, and payroll finance — in one place.",
        meta: "Payroll & finance",
    },
    "Company settings": {
        description: "Manage company details, roles, and workflow settings.",
        meta: "Configuration",
    },
    "Audit log": {
        description: "Inspect the app-wide history of approvals, edits, deletions, and rule changes.",
        meta: "Audit trail",
    },
    "Payroll and contract rules": {
        description: "Manage per-sector CAO sources, wage checks, payroll rules, and the contract values they feed.",
        meta: "Sector rules",
    },
};

export default function Management() {
    const { permissions } = useAuth();
    // Collapse the individual payroll/finance tiles into a single "Finance" entry
    // that links to the consolidated Finance hub. Each underlying page keeps its
    // own permission, and the hub only shows the tiles the user may access.
    const rawItems = getManagementNavItems(permissions).filter((item) => item.label !== "Messages");
    const hasFinanceAccess = rawItems.some((item) => FINANCE_NAV_LABELS.includes(item.label));
    const items = [
        ...rawItems.filter((item) => !FINANCE_NAV_LABELS.includes(item.label)),
        ...(hasFinanceAccess
            ? [{ label: "Finance", to: "/management/finance", permissions: [] }]
            : []),
    ];
    const sections = buildManagementSections(items);

    const [pendingCounts, setPendingCounts] = useState<PendingCounts>(EMPTY_COUNTS);

    useEffect(() => {
        let cancelled = false;

        const canSeeTravelClaims = hasAnyPermission(permissions, ["CAN_MANAGE_TIMESHEETS"]);
        const canSeeApplications = hasAnyPermission(permissions, APPLICATION_REVIEW_PERMISSIONS);
        const canSeeOnboardingReview = hasAnyPermission(permissions, ONBOARDING_REVIEW_PERMISSIONS);
        const canSeePayslipReview = hasAnyPermission(permissions, ["CAN_REVIEW_PAYSLIPS"]);

        const loadCounts = async () => {
            // Each fetch is independent and failures should not break the page or
            // other badges. Default missing counts to 0.
            const [travelClaims, applications, onboardingReview, payslipReview] = await Promise.all([
                canSeeTravelClaims
                    ? UserServices.getPendingTravelClaims()
                          .then((rows) => rows.length)
                          .catch(() => 0)
                    : Promise.resolve(0),
                canSeeApplications
                    ? UserServices.getApplications()
                          .then((rows) =>
                              rows.filter(
                                  (application) =>
                                      (application.status ?? "").toUpperCase() === "APPLICATION_SUBMITTED"
                              ).length
                          )
                          .catch(() => 0)
                    : Promise.resolve(0),
                canSeeOnboardingReview
                    ? UserServices.getUsers()
                          .then((rows) =>
                              rows.filter((user) =>
                                  ONBOARDING_REVIEW_STATUSES.has((user.status ?? "").toUpperCase())
                              ).length
                          )
                          .catch(() => 0)
                    : Promise.resolve(0),
                canSeePayslipReview
                    ? UserServices.getPayslipsForReview()
                          .then((rows) => rows.length)
                          .catch(() => 0)
                    : Promise.resolve(0),
            ]);

            if (cancelled) return;
            setPendingCounts({ travelClaims, applications, onboardingReview, payslipReview });
        };

        void loadCounts();

        return () => {
            cancelled = true;
        };
    }, [permissions]);

    const pendingCountFor = (label: string): number => {
        switch (label) {
            case "Travel claims":
                return pendingCounts.travelClaims;
            case "Applications":
                return pendingCounts.applications;
            case "Onboarding review":
                return pendingCounts.onboardingReview;
            case "Payslip review":
                return pendingCounts.payslipReview;
            case "Finance":
                return pendingCounts.travelClaims + pendingCounts.payslipReview;
            default:
                return 0;
        }
    };

    return (
        <>
            <Navbar />
            <div className="managementPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <main className="pageShellContent">
                        <header className="managementHeader">
                            <div>
                                <h1 className="managementTitle">Management</h1>
                                <p className="managementSubtitle">
                                    Open the company tools available to your account.
                                </p>
                            </div>
                        </header>
                        {items.length === 0 ? (
                            <Card title="No management access" className="managementNotice">
                                <p>Your account does not currently include management permissions.</p>
                            </Card>
                        ) : (
                            <div className="managementSections">
                                {sections.map((section) => (
                                    <section className="managementSection" key={section.key}>
                                        <div className="managementSectionHeader">
                                            <h2>{section.title}</h2>
                                            <p>{section.description}</p>
                                        </div>
                                        <div className="managementGrid">
                                            {section.items.map((item) => {
                                                const details = cardDetails[item.label] ?? {
                                                    description: "Open this management workspace.",
                                                    meta: "Management tool",
                                                };
                                                const linkState =
                                                    item.to === "/account/company"
                                                        ? { accountReturnTo: "/management" }
                                                        : undefined;

                                                const badgeCount = BADGE_LABELS.has(item.label)
                                                    ? pendingCountFor(item.label)
                                                    : 0;
                                                const ariaLabel =
                                                    badgeCount > 0
                                                        ? `Open ${item.label}, ${badgeCount} pending`
                                                        : `Open ${item.label}`;

                                                return (
                                                    <Link
                                                        key={item.label}
                                                        className="managementCardLink"
                                                        to={item.to}
                                                        state={linkState}
                                                        aria-label={ariaLabel}
                                                    >
                                                        {badgeCount > 0 ? (
                                                            <span
                                                                className="managementCardBadge"
                                                                aria-hidden="true"
                                                            >
                                                                {formatBadgeCount(badgeCount)}
                                                            </span>
                                                        ) : null}
                                                        <Card title={item.label} className="managementCard">
                                                            <div className="managementCardBody">
                                                                <span className="managementCardMeta">{details.meta}</span>
                                                                <p className="managementCardText">{details.description}</p>
                                                            </div>
                                                        </Card>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </>
    );
}
