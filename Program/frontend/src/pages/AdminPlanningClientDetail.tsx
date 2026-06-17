import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NavLink, Outlet, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Spinner from "../components/Spinner";
import {
    UserServices,
    type PlanningClientCompanyDTO,
    type PlanningLocationDTO,
} from "../services/user-service/UserServices";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/GeneralInfo.css";
import "../stylesheets/Profile.css";
import "../stylesheets/UserDashboard.css";
import "../stylesheets/AdminUserDetails.css";
import "../stylesheets/AdminPlanningClients.css";

export type ClientDetailOutletContext = {
    client: PlanningClientCompanyDTO;
    formatValue: (value: string | number | boolean | null | undefined) => string | number;
};

function clientInitial(name?: string | null): string {
    return (name?.trim()?.[0] ?? "C").toUpperCase();
}

export default function AdminPlanningClientDetail() {
    const { clientCompanyId } = useParams<{ clientCompanyId: string }>();
    const [client, setClient] = useState<PlanningClientCompanyDTO | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [locations, setLocations] = useState<PlanningLocationDTO[]>([]);

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

    useEffect(() => {
        if (!clientCompanyId) return;
        let cancelled = false;
        UserServices.getPlanningLocations(clientCompanyId)
            .then((data) => {
                if (!cancelled) setLocations(data);
            })
            .catch(() => {
                if (!cancelled) setLocations([]);
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

    const presetLocationCount = useMemo(() => {
        if (!client) return 0;
        return locations.filter((location) =>
            (location.prioritizedClientCompanyIds ?? []).includes(client.clientCompanyId)
        ).length;
    }, [locations, client]);

    const identityMetrics = useMemo(() => {
        if (!client) {
            return [
                { label: "Contacts", value: "0" },
                { label: "Preset locations", value: "0" },
            ];
        }
        return [
            { label: "Contacts", value: String((client.contacts ?? []).length) },
            { label: "Preset locations", value: String(presetLocationCount) },
        ];
    }, [client, presetLocationCount]);

    const renderShell = (children: ReactNode) => (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <div className="adminDashboardCard adminUserDetailsPage">{children}</div>
                    </div>
                </div>
            </div>
        </>
    );

    if (loading) {
        return renderShell(
            <section className="adminUserDetailsHero">
                <div className="adminUserDetailsHeaderTop">
                    <PageBack to="/management/clients" preferTarget />
                    <div className="adminUserDetailsHeaderRow">
                        <div className="pageHeader adminUserDetailsHeader">
                            <h1 className="pageTitle">Client</h1>
                            <p className="pageSubtitle">
                                Profile, contacts, and locations in one consistent workspace.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="adminUserDetailsHeroState">
                    <Spinner text="Loading client" />
                </div>
            </section>
        );
    }

    if (error || !client) {
        return renderShell(
            <section className="adminUserDetailsHero">
                <div className="adminUserDetailsHeaderTop">
                    <PageBack to="/management/clients" preferTarget />
                    <div className="adminUserDetailsHeaderRow">
                        <div className="pageHeader adminUserDetailsHeader">
                            <h1 className="pageTitle">Client</h1>
                            <p className="pageSubtitle">
                                Profile, contacts, and locations in one consistent workspace.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="workHistoryError">{error ?? "Client not found."}</div>
            </section>
        );
    }

    const displayName = client.name?.trim() || "Client";
    const address = client.address?.trim();
    const companyLine = client.companyLine?.trim();

    return renderShell(
        <>
            <section className="adminUserDetailsHero">
                <div className="adminUserDetailsHeaderTop">
                    <PageBack to="/management/clients" preferTarget />
                    <div className="adminUserDetailsHeaderRow">
                        <div className="pageHeader adminUserDetailsHeader">
                            <h1 className="pageTitle">Client Details</h1>
                            <p className="pageSubtitle">
                                Profile, contacts, and locations in one consistent workspace.
                            </p>
                        </div>
                    </div>
                </div>

                <nav className="adminUserDetailsTabs" aria-label="Client detail tabs">
                    <NavLink
                        to={detailRoot}
                        end
                        className={({ isActive }) =>
                            `adminUserDetailsTab ${isActive ? "adminUserDetailsTab--active" : ""}`
                        }
                    >
                        General information
                    </NavLink>
                    <NavLink
                        to={detailLocations}
                        className={({ isActive }) =>
                            `adminUserDetailsTab ${isActive ? "adminUserDetailsTab--active" : ""}`
                        }
                    >
                        Locations
                    </NavLink>
                </nav>

                <div className="adminUserIdentity">
                    <div
                        className={`planningClientAvatar planningClientAvatar--large adminUserIdentityAvatar ${
                            client.profilePictureUrl ? "planningClientAvatar--image" : ""
                        }`}
                        aria-label="Client profile picture"
                    >
                        {client.profilePictureUrl ? (
                            <img
                                className="planningClientAvatarImage"
                                src={client.profilePictureUrl}
                                alt={`${displayName} profile`}
                            />
                        ) : (
                            <span className="planningClientAvatarLetter">
                                {clientInitial(client.name)}
                            </span>
                        )}
                    </div>

                    <div className="adminUserIdentityMain">
                        <div className="adminUserIdentityNameRow">
                            <h2 className="adminUserIdentityName">{displayName}</h2>
                        </div>
                        {address ? (
                            <p className="adminUserIdentityEmail">{address}</p>
                        ) : null}
                        <div className="adminUserIdentityMeta">
                            {companyLine ? <span>{companyLine}</span> : null}
                            <span>
                                {(client.contacts ?? []).length} contact
                                {(client.contacts ?? []).length === 1 ? "" : "s"}
                            </span>
                        </div>
                    </div>

                    <div className="adminUserIdentityMetrics">
                        {identityMetrics.map((metric) => (
                            <div key={metric.label} className="adminUserIdentityMetric">
                                <div className="adminUserIdentityMetricLabel">{metric.label}</div>
                                <div className="adminUserIdentityMetricValue">{metric.value}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="adminUserDetailsTabPanel">
                <Outlet
                    context={{
                        client,
                        formatValue,
                    }}
                />
            </section>
        </>
    );
}
