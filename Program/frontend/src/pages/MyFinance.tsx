import { NavLink, Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import { useAuth } from "../context/AuthContext";
import "../stylesheets/MyFinance.css";

type FinanceTab = {
    to: string;
    label: string;
    end?: boolean;
    visible: boolean;
};

export default function MyFinance() {
    const { hasAnyPermission } = useAuth();

    const canViewPayslips = hasAnyPermission(["CAN_VIEW_PAYSLIPS", "CAN_VIEW_ALL_PAYSLIPS"]);
    const canViewContract = hasAnyPermission(["CAN_VIEW_OWN_CONTRACTS", "CAN_VIEW_ALL_CONTRACTS"]);

    // Tabs are hidden (not disabled) when the permission is missing, so the page
    // looks complete whatever the user can see.
    const tabs: FinanceTab[] = [
        { to: "/my-finance", label: "Overview", end: true, visible: true },
        { to: "/my-finance/payslips", label: "Payslips", visible: canViewPayslips },
        { to: "/my-finance/work-history", label: "Work history", visible: true },
        { to: "/my-finance/contract", label: "Contract", visible: canViewContract },
        { to: "/my-finance/documents", label: "Documents", visible: canViewPayslips },
    ];

    return (
        <>
            <Navbar />
            <div className="myFinancePage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <div className="pageHeader">
                            <h1 className="pageTitle">My finance</h1>
                        </div>
                        <div className="myFinanceCard">
                            <nav className="myFinanceTabs" aria-label="Finance sections">
                                {tabs
                                    .filter((tab) => tab.visible)
                                    .map((tab) => (
                                        <NavLink
                                            key={tab.to}
                                            to={tab.to}
                                            end={tab.end}
                                            className={({ isActive }) =>
                                                `myFinanceTab${isActive ? " myFinanceTab--active" : ""}`
                                            }
                                        >
                                            {tab.label}
                                        </NavLink>
                                    ))}
                            </nav>
                            <div className="myFinanceTabBody">
                                <Outlet />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
