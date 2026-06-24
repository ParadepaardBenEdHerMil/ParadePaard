import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import PageBack from "../components/PageBack";
import Card from "../components/common/Card";
import { useAuth } from "../context/AuthContext";
import { getFinanceNavItems, hasAnyPermission } from "../utils/permissionPolicy";
import { UserServices } from "../services/user-service/UserServices";
import "../stylesheets/Management.css";

// Cards that show a pending-work counter badge.
const BADGE_LABELS = new Set(["Travel claims", "Payslip review"]);

const cardDetails: Record<string, { description: string; meta: string }> = {
    "Work history": {
        description: "View all worked shifts, filter the history, and choose saved table columns.",
        meta: "Company history",
    },
    "Travel claims": {
        description: "Review submitted travel claims and approve or reject expenses.",
        meta: "Expense review",
    },
    "All payslips": {
        description: "Inspect company payslips by employee, date, week, and status. Download jaaropgaven and the verzamelloonstaat.",
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
};

function formatBadgeCount(value: number): string {
    return value > 99 ? "99+" : String(value);
}

export default function Finance() {
    const { permissions } = useAuth();
    const items = getFinanceNavItems(permissions);

    const [travelClaims, setTravelClaims] = useState(0);
    const [payslipReview, setPayslipReview] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const canSeeTravelClaims = hasAnyPermission(permissions, ["CAN_MANAGE_TIMESHEETS"]);
        const canSeePayslipReview = hasAnyPermission(permissions, ["CAN_REVIEW_PAYSLIPS"]);

        const load = async () => {
            const [tc, pr] = await Promise.all([
                canSeeTravelClaims
                    ? UserServices.getPendingTravelClaims().then((r) => r.length).catch(() => 0)
                    : Promise.resolve(0),
                canSeePayslipReview
                    ? UserServices.getPayslipsForReview().then((r) => r.length).catch(() => 0)
                    : Promise.resolve(0),
            ]);
            if (cancelled) return;
            setTravelClaims(tc);
            setPayslipReview(pr);
        };
        void load();
        return () => {
            cancelled = true;
        };
    }, [permissions]);

    const pendingCountFor = (label: string): number => {
        if (label === "Travel claims") return travelClaims;
        if (label === "Payslip review") return payslipReview;
        return 0;
    };

    return (
        <>
            <Navbar />
            <div className="managementPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <main className="pageShellContent">
                        <header className="managementHeader">
                            <PageBack to="/management" />
                            <div>
                                <h1 className="managementTitle">Finance</h1>
                                <p className="managementSubtitle">
                                    Payslips, work history, travel claims, the review queue, and payroll finance.
                                </p>
                            </div>
                        </header>
                        {items.length === 0 ? (
                            <Card title="No finance access" className="managementNotice">
                                <p>Your account does not currently include finance permissions.</p>
                            </Card>
                        ) : (
                            <div className="managementGrid">
                                {items.map((item) => {
                                    const details = cardDetails[item.label] ?? {
                                        description: "Open this finance workspace.",
                                        meta: "Finance tool",
                                    };
                                    const badgeCount = BADGE_LABELS.has(item.label) ? pendingCountFor(item.label) : 0;
                                    const ariaLabel =
                                        badgeCount > 0 ? `Open ${item.label}, ${badgeCount} pending` : `Open ${item.label}`;
                                    return (
                                        <Link
                                            key={item.label}
                                            className="managementCardLink"
                                            to={item.to}
                                            aria-label={ariaLabel}
                                        >
                                            {badgeCount > 0 ? (
                                                <span className="managementCardBadge" aria-hidden="true">
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
                        )}
                    </main>
                </div>
            </div>
        </>
    );
}
