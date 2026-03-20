import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthServices } from "../services/auth-service/AuthServices";
import "../stylesheets/PrimaryNav.css";

export default function PrimaryNav() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [canViewPayslips, setCanViewPayslips] = useState(false);
    const [canManagePlanning, setCanManagePlanning] = useState(false);
    const location = useLocation();
    const path = location.pathname;
    const personalView = new URLSearchParams(location.search).get("view") === "personal";

    const isDashboardActive = path === "/dashboard";
    const isUsersActive = path.startsWith("/admin/user");
    const isOnboardingActive = path.startsWith("/admin/onboarding");
    const isPlanningActive = path.startsWith("/admin/planning");
    const isClientsActive = path.startsWith("/admin/clients");
    const isPayslipsActive =
        path.startsWith("/payslips") || path.startsWith("/admin/payslip");
    const isWorkHistoryActive = path.startsWith("/work-history");
    const isAccountActive = path.startsWith("/account");

    const linkClass = (active: boolean) =>
        `nav_quick_link primaryNavLink${active ? " primaryNavLink--active" : ""}`;
    const withPersonalView = (target: string) =>
        personalView ? `${target}?view=personal` : target;

    useEffect(() => {
        let cancelled = false;

        AuthServices.isAdmin()
            .then((value) => {
                if (!cancelled) setIsAdmin(Boolean(value));
            })
            .catch(() => {
                if (!cancelled) setIsAdmin(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        AuthServices.getPermissions()
            .then((perms) => {
                if (cancelled) return;
                const list = perms ?? [];
                setCanViewPayslips(
                    list.includes("CAN_VIEW_PAYSLIPS") || list.includes("CAN_VIEW_ALL_PAYSLIPS")
                );
                setCanManagePlanning(list.includes("CAN_MANAGE_PLANNING"));
            })
            .catch(() => {
                if (!cancelled) {
                    setCanViewPayslips(false);
                    setCanManagePlanning(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <nav className="primaryNav" aria-label="Primary navigation">
            <div className="primaryNavLinks">
                <Link
                    className={linkClass(isDashboardActive)}
                    to={withPersonalView("/dashboard")}
                    aria-current={isDashboardActive ? "page" : undefined}
                    aria-label="Dashboard"
                    title="Dashboard"
                >
                    <svg
                        className="nav_quick_icon"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M3 11l9-8 9 8" />
                        <path d="M5 10v10h14V10" />
                    </svg>
                    <span className="nav_quick_text">Dashboard</span>
                </Link>

                {isAdmin && !personalView ? (
                    <Link
                        className={linkClass(isUsersActive)}
                        to="/admin/users"
                        aria-current={isUsersActive ? "page" : undefined}
                        aria-label="Users"
                        title="Users"
                    >
                        <svg
                            className="nav_quick_icon"
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span className="nav_quick_text">Users</span>
                    </Link>
                ) : null}

                {(isAdmin || canManagePlanning) && !personalView ? (
                    <Link
                        className={linkClass(isPlanningActive)}
                        to="/admin/planning"
                        aria-current={isPlanningActive ? "page" : undefined}
                        aria-label="Planning"
                        title="Planning"
                    >
                        <svg
                            className="nav_quick_icon"
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <path d="M16 2v4" />
                            <path d="M8 2v4" />
                            <path d="M3 10h18" />
                        </svg>
                        <span className="nav_quick_text">Planning</span>
                    </Link>
                ) : null}

                {(isAdmin || canManagePlanning) && !personalView ? (
                    <Link
                        className={linkClass(isClientsActive)}
                        to="/admin/clients"
                        aria-current={isClientsActive ? "page" : undefined}
                        aria-label="Clients"
                        title="Clients"
                    >
                        <svg
                            className="nav_quick_icon"
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M3 7h18" />
                            <path d="M5 7V5a2 2 0 0 1 2-2h3l2 2h5a2 2 0 0 1 2 2v2" />
                            <path d="M5 7v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7" />
                        </svg>
                        <span className="nav_quick_text">Clients</span>
                    </Link>
                ) : null}

                {isAdmin && !personalView ? (
                    <Link
                        className={linkClass(isOnboardingActive)}
                        to="/admin/onboarding"
                        aria-current={isOnboardingActive ? "page" : undefined}
                        aria-label="Onboarding"
                        title="Onboarding"
                    >
                        <svg
                            className="nav_quick_icon"
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M12 5v14" />
                            <path d="M5 12h14" />
                        </svg>
                        <span className="nav_quick_text">Onboarding</span>
                    </Link>
                ) : null}

                {canViewPayslips ? (
                    <Link
                        className={linkClass(isPayslipsActive)}
                        to={withPersonalView("/payslips")}
                        aria-current={isPayslipsActive ? "page" : undefined}
                        aria-label="Payslips"
                        title="Payslips"
                    >
                        <svg
                            className="nav_quick_icon"
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                            <path d="M14 3v5h5" />
                            <path d="M9 13h6" />
                            <path d="M9 17h6" />
                        </svg>
                        <span className="nav_quick_text">Payslips</span>
                    </Link>
                ) : null}

                <Link
                    className={linkClass(isWorkHistoryActive)}
                    to={withPersonalView("/work-history")}
                    aria-current={isWorkHistoryActive ? "page" : undefined}
                    aria-label="Work history"
                    title="Work history"
                >
                    <svg
                        className="nav_quick_icon"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v6l4 2" />
                    </svg>
                    <span className="nav_quick_text">Work history</span>
                </Link>

                <Link
                    className={linkClass(isAccountActive)}
                    to={withPersonalView("/account")}
                    aria-current={isAccountActive ? "page" : undefined}
                    aria-label="Account"
                    title="Account"
                >
                    <svg
                        className="nav_quick_icon"
                        viewBox="0 0 24 24"
                        width="18"
                        height="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M20 21a8 8 0 1 0-16 0" />
                        <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span className="nav_quick_text">Account</span>
                </Link>
            </div>
        </nav>
    );
}
