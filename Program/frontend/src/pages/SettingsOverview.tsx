import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Card from "../components/common/Card";
import { AuthServices } from "../services/auth-service/AuthServices";
import "../stylesheets/Settings.css";

export default function SettingsOverview() {
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
        <div className="settingsOverviewGrid">
            <Card title="Account">
                <div className="settingsCardBody">
                    <p className="settingsHelperText">
                        Review your personal details, profile photo, and payroll preferences.
                    </p>
                    <Link className="button settingsAction" to="/profile">
                        Open profile
                    </Link>
                </div>
            </Card>

            {permissionsLoaded && canManageCompany ? (
                <Card title="Company">
                    <div className="settingsCardBody">
                        <p className="settingsHelperText">
                            Manage roles and permissions across the organization.
                        </p>
                        <Link className="button settingsAction" to="/settings/company">
                            Company settings
                        </Link>
                    </div>
                </Card>
            ) : null}
        </div>
    );
}
