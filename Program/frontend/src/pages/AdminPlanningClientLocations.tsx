import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import Card from "../components/common/Card";
import {
    UserServices,
    type PlanningLocationDTO,
} from "../services/user-service/UserServices";
import { buildPlanningLocationAddressLines } from "../utils/planningLocationAddress";
import type { ClientDetailOutletContext } from "./AdminPlanningClientDetail";

function formatLocationAddress(location: PlanningLocationDTO): string {
    const { line1, line2 } = buildPlanningLocationAddressLines(location);
    const parts = [line1, line2].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "-";
}

export default function AdminPlanningClientLocations() {
    const { client } = useOutletContext<ClientDetailOutletContext>();
    const [locations, setLocations] = useState<PlanningLocationDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        UserServices.getPlanningLocations(client.clientCompanyId)
            .then((data) => {
                if (!cancelled) setLocations(data);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : "Failed to load locations.";
                setError(message);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [client.clientCompanyId]);

    const presetLocations = useMemo(
        () =>
            locations.filter((location) =>
                (location.prioritizedClientCompanyIds ?? []).includes(client.clientCompanyId)
            ),
        [locations, client.clientCompanyId]
    );

    const cardRight = (
        <Link to="/management/locations" className="buttonSecondary">
            View all locations
        </Link>
    );

    return (
        <Card title="Preset locations" right={cardRight} className="adminUserDetailsPanel">
            {loading ? (
                <div className="generalInfoRows">
                    <div className="profile_info_row">
                        <span className="profile_info_label">Locations</span>
                        <span className="profile_info_value">Loading...</span>
                    </div>
                </div>
            ) : error ? (
                <div className="generalInfoRows">
                    <div className="profile_info_row">
                        <span className="profile_info_label">Locations</span>
                        <span className="profile_info_value">{error}</span>
                    </div>
                </div>
            ) : presetLocations.length === 0 ? (
                <div className="generalInfoRows">
                    <div className="profile_info_row">
                        <span className="profile_info_label">Locations</span>
                        <span className="profile_info_value">
                            No preset locations for this client yet.
                        </span>
                    </div>
                </div>
            ) : (
                <div className="generalInfoRows">
                    {presetLocations.map((location) => (
                        <div className="profile_info_row" key={location.locationId}>
                            <span className="profile_info_label">{location.name}</span>
                            <span className="profile_info_value">{formatLocationAddress(location)}</span>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}
