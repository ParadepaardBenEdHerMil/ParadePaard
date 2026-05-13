import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { useAuth } from "../context/AuthContext";
import { getManagementNavItems } from "../utils/permissionPolicy";
import { buildManagementSections } from "../utils/managementSections";
import "../stylesheets/Management.css";

const cardDetails: Record<string, { description: string; meta: string }> = {
    Users: {
        description: "Open the employee directory, inspect profiles, and review access details.",
        meta: "Employee directory",
    },
    Onboarding: {
        description: "Invite a new employee and start their account and contract setup.",
        meta: "New employee setup",
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
        description: "Create events, build shifts, and schedule people into work.",
        meta: "Events and shifts",
    },
    Clients: {
        description: "Manage client companies, contacts, addresses, and planning notes.",
        meta: "Planning contacts",
    },
    "Travel claims": {
        description: "Review submitted travel claims and approve or reject expenses.",
        meta: "Expense review",
    },
    "All payslips": {
        description: "Inspect company payslips by employee, date, week, and status.",
        meta: "Company payroll",
    },
    "Payslip review": {
        description: "Open the payroll review queue for payslips that need attention.",
        meta: "Review queue",
    },
    "Company settings": {
        description: "Manage company details, roles, workflow settings, and tax setup.",
        meta: "Configuration",
    },
};

export default function Management() {
    const { permissions } = useAuth();
    const items = getManagementNavItems(permissions);
    const sections = buildManagementSections(items);

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

                                                return (
                                                    <Link
                                                        key={item.label}
                                                        className="managementCardLink"
                                                        to={item.to}
                                                        state={linkState}
                                                        aria-label={`Open ${item.label}`}
                                                    >
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
