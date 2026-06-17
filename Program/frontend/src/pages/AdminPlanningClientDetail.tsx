import { useEffect, useState } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import Spinner from "../components/Spinner";
import {
    UserServices,
    type PlanningClientCompanyDTO,
} from "../services/user-service/UserServices";
import "../stylesheets/Profile.css";
import "../stylesheets/Settings.css";
import "../stylesheets/UserDashboard.css";
import "../stylesheets/AdminPlanningClients.css";

export type ClientDetailOutletContext = {
    client: PlanningClientCompanyDTO;
    formatValue: (value: string | number | boolean | null | undefined) => string | number;
};

export default function AdminPlanningClientDetail() {
    const { clientCompanyId } = useParams<{ clientCompanyId: string }>();
    const [client, setClient] = useState<PlanningClientCompanyDTO | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!clientCompanyId) return;
        let cancelled = false;
        setLoading(true);
        setError(null);

        UserServices.getPlanningClients()
            .then((data) => {
                if (cancelled) return;
                const match = data.find((entry) => entry.clientCompanyId === clientCompanyId);
                if (!match) {
                    setError("Client not found.");
                    setClient(null);
                } else {
                    setClient(match);
                }
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : "Failed to load client.";
                setError(message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [clientCompanyId]);

    const detailRoot = `/management/clients/${clientCompanyId ?? ""}`;
    const detailLocations = `/management/clients/${clientCompanyId ?? ""}/locations`;

    const formatValue = (value: string | number | boolean | null | undefined) => {
        if (value === null || value === undefined || value === "") return "-";
        if (typeof value === "boolean") return value ? "Yes" : "No";
        return value;
    };

    if (loading) {
        return (
            <>
                <Navbar />
                <Spinner text="Loading client" />
            </>
        );
    }

    if (error || !client) {
        return (
            <>
                <Navbar />
                <div className="pageShell">
                    <div className="accountLayout">
                        <aside className="accountSidebarHeader">
                            <header className="pageHeader">
                                <PageBack to="/management/clients" preferTarget />
                                <h1 className="pageTitle">Client</h1>
                            </header>
                        </aside>
                        <div className="accountMain">
                            <div className="accountMainInner">
                                <div className="userDashboardCard settingsCard accountPage">
                                    <div className="settingsContent">
                                        <div className="error-container">
                                            {error ?? "Client not found."}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <div className="pageShell">
                <div className="accountLayout">
                    <aside className="accountSidebarHeader">
                        <header className="pageHeader">
                            <PageBack to="/management/clients" preferTarget />
                            <h1 className="pageTitle">{client.name || "Client"}</h1>
                        </header>
                    </aside>
                    <aside className="accountSidebarNav">
                        <nav className="settingsNav">
                            <NavLink
                                to={detailRoot}
                                end
                                className={({ isActive }) =>
                                    `settingsNavLink ${isActive ? "settingsNavLink--active" : ""}`
                                }
                            >
                                General information
                            </NavLink>
                            <NavLink
                                to={detailLocations}
                                className={({ isActive }) =>
                                    `settingsNavLink ${isActive ? "settingsNavLink--active" : ""}`
                                }
                            >
                                Locations
                            </NavLink>
                        </nav>
                    </aside>
                    <div className="accountMain">
                        <div className="accountMainInner">
                            <div className="userDashboardCard settingsCard accountPage">
                                <div className="settingsContent">
                                    <Outlet
                                        context={{
                                            client,
                                            formatValue,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
