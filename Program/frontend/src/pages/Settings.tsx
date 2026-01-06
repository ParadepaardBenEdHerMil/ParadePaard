import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import { AuthServices } from "../services/auth-service/AuthServices";
import "../stylesheets/UserDashboard.css";
import "../stylesheets/Settings.css";

export default function Settings() {
    const [permissions, setPermissions] = useState<string[]>([]);
    const [permissionsLoaded, setPermissionsLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        AuthServices.getPermissions()
            .then((data) => {
                if (!cancelled) setPermissions(data ?? []);
            })
            .catch(() => {
                if (!cancelled) setPermissions([]);
            })
            .finally(() => {
                if (!cancelled) setPermissionsLoaded(true);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const canManageCompany =
        permissions.includes("CAN_CREATE_ROLE") || permissions.includes("CAN_ASSIGN_ROLES");

    return (
        <>
            <Navbar />
            <div className="userDashboardCard settingsCard">
                <header className="pageHeader">
                    <h1 className="pageTitle">Settings</h1>
                    <p className="pageSubtitle">Manage your account and company preferences</p>
                </header>

                <div className="settingsLayout">
                    <aside className="settingsNav">
                        <NavLink
                            to="/settings"
                            end
                            className={({ isActive }) =>
                                `settingsNavLink ${isActive ? "settingsNavLink--active" : ""}`
                            }
                        >
                            Overview
                        </NavLink>
                        {permissionsLoaded && canManageCompany ? (
                            <NavLink
                                to="/settings/company"
                                className={({ isActive }) =>
                                    `settingsNavLink ${isActive ? "settingsNavLink--active" : ""}`
                                }
                            >
                                Company settings
                            </NavLink>
                        ) : null}
                    </aside>

                    <div className="settingsContent">
                        <Outlet />
                    </div>
                </div>
            </div>
        </>
    );
}
