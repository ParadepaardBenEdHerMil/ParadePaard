import { useEffect, useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Spinner from "../components/Spinner";
import Card from "../components/common/Card";
import { UserServices, type EmployeePlanningAssignmentDTO } from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";
import "../stylesheets/WorkHistory.css";

function formatMoney(value: number | null | undefined): string {
    return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(value ?? 0));
}

export default function TravelClaims() {
    const [pendingClaims, setPendingClaims] = useState<EmployeePlanningAssignmentDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [claimActionId, setClaimActionId] = useState<string | null>(null);

    const claimCountLabel = useMemo(() => {
        const count = pendingClaims.length;
        return `${count} pending`;
    }, [pendingClaims.length]);

    useEffect(() => {
        let cancelled = false;

        const loadClaims = async () => {
            try {
                setLoading(true);
                setError(null);
                const data = await UserServices.getPendingTravelClaims();
                if (!cancelled) setPendingClaims(data);
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Failed to load pending travel claims");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void loadClaims();

        return () => {
            cancelled = true;
        };
    }, []);

    const openProof = async (scheduleEntryId: string) => {
        try {
            const blob = await UserServices.getTravelClaimProof(scheduleEntryId, true);
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener,noreferrer");
            setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to open travel claim proof");
        }
    };

    const reviewClaim = async (scheduleEntryId: string, status: "APPROVED" | "REJECTED") => {
        const rejectionNote =
            status === "REJECTED" ? window.prompt("Why is this claim rejected?", "") ?? "" : undefined;

        try {
            setClaimActionId(`${scheduleEntryId}:${status}`);
            setError(null);
            await UserServices.reviewTravelClaim(scheduleEntryId, { status, rejectionNote });
            setPendingClaims((current) => current.filter((claim) => claim.scheduleEntryId !== scheduleEntryId));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to review travel claim");
        } finally {
            setClaimActionId(null);
        }
    };

    return (
        <>
            <Navbar />
            <div className="workHistoryPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header
                            className="workHistoryHeader"
                            style={{ flexDirection: "row", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}
                        >
                            <div>
                                <PageBack to="/management" />
                                <h1 className="workHistoryTitle">Travel Claims</h1>
                            </div>
                        </header>
                        <div className="workHistoryShell">
                            {loading ? (
                                <div className="workHistoryLoading">
                                    <Spinner text="Loading pending travel claims" />
                                </div>
                            ) : (
                                <Card
                                    title="Pending travel claims"
                                    right={<span style={{ fontSize: 13, color: "#556070" }}>{claimCountLabel}</span>}
                                    className="workHistoryCard"
                                >
                                    {error ? <div className="workHistoryError">{error}</div> : null}
                                    {!error && pendingClaims.length === 0 ? (
                                        <div className="workHistoryEmpty">No pending travel claims.</div>
                                    ) : null}
                                    {!error && pendingClaims.length > 0 ? (
                                        <div style={{ display: "grid", gap: 12 }}>
                                            {pendingClaims.map((claim) => (
                                                <div key={claim.scheduleEntryId} className="requestListRow">
                                                    <div className="requestMainLine">
                                                        <span className="reqDateRange">{claim.userDisplayName ?? claim.userId}</span>
                                                        <span className="reqTotalHours">{claim.eventName}</span>
                                                        <span className="reqTotalHours">{claim.travelClaim?.kilometers ?? 0} km</span>
                                                        <span className="reqTotalHours">
                                                            {formatMoney(claim.travelClaim?.totalAmount ?? 0)}
                                                        </span>
                                                    </div>
                                                    <div className="requestNoteLine">
                                                        {formatDate(claim.shiftDate)} | {claim.shiftName ?? claim.functionName} |{" "}
                                                        {claim.shiftLocation ?? claim.eventLocation ?? "-"}
                                                    </div>
                                                    <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                                                        {claim.travelClaim?.hasProof ? (
                                                            <button
                                                                type="button"
                                                                className="button"
                                                                onClick={() => void openProof(claim.scheduleEntryId)}
                                                            >
                                                                View proof
                                                            </button>
                                                        ) : null}
                                                        <button
                                                            type="button"
                                                            className="button userPlanningAcceptButton"
                                                            disabled={Boolean(claimActionId)}
                                                            onClick={() => void reviewClaim(claim.scheduleEntryId, "APPROVED")}
                                                        >
                                                            {claimActionId === `${claim.scheduleEntryId}:APPROVED`
                                                                ? "Approving..."
                                                                : "Approve"}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button userPlanningDeclineButton"
                                                            disabled={Boolean(claimActionId)}
                                                            onClick={() => void reviewClaim(claim.scheduleEntryId, "REJECTED")}
                                                        >
                                                            {claimActionId === `${claim.scheduleEntryId}:REJECTED`
                                                                ? "Rejecting..."
                                                                : "Reject"}
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                </Card>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
