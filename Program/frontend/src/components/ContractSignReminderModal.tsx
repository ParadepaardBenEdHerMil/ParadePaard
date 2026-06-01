import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserServices } from "../services/user-service/UserServices";
import type { ContractResponseDTO } from "../services/user-service/UserServices";
import Modal from "./common/Modal";

// Inlined here (rather than imported from App.tsx) to avoid a circular import
// since App.tsx renders Dashboard, which renders this component.
const contractSignPath = (contractId: string) => `/contracts/${contractId}/sign`;

// Statuses where the employee can sign. Mirrors AccountEmploymentDetails.
const SIGNABLE_CONTRACT_STATUSES = new Set(["SENT_TO_EMPLOYEE", "REJECTED"]);

// Session-storage key used to suppress the modal after the user has dismissed
// it once in the current browser tab. We deliberately use sessionStorage (not
// localStorage) so the next fresh login re-shows the prompt.
const DISMISS_STORAGE_KEY = "contractSignReminderDismissedFor";

function readDismissedContractId(): string | null {
    try {
        return sessionStorage.getItem(DISMISS_STORAGE_KEY);
    } catch {
        return null;
    }
}

function writeDismissedContractId(contractId: string) {
    try {
        sessionStorage.setItem(DISMISS_STORAGE_KEY, contractId);
    } catch {
        // ignore storage failures
    }
}

function formatDate(value?: string | null): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("nl-NL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}

/**
 * After login the user lands on the dashboard. If a contract is waiting for
 * their signature, show a one-time-per-session popup that links straight to
 * the signing page so they don't have to hunt for it in the account section.
 */
export default function ContractSignReminderModal() {
    const navigate = useNavigate();
    const { status, loading } = useAuth();
    const [contract, setContract] = useState<ContractResponseDTO | null>(null);
    const [open, setOpen] = useState(false);

    const isPotentiallySignable = useMemo(() => {
        // Only PENDING_CONTRACT_SIGNATURE users see the reminder. Other
        // statuses either have no contract yet or are blocked from /dashboard
        // by RequireActiveUser.
        return status === "PENDING_CONTRACT_SIGNATURE";
    }, [status]);

    useEffect(() => {
        if (loading) return;
        if (!isPotentiallySignable) {
            setContract(null);
            setOpen(false);
            return;
        }

        let cancelled = false;

        const checkContract = async () => {
            try {
                const current = await UserServices.getCurrentContract();
                if (cancelled) return;
                if (!current?.contractId) return;
                if (!SIGNABLE_CONTRACT_STATUSES.has((current.status ?? "").toUpperCase())) return;
                if (readDismissedContractId() === current.contractId) return;
                setContract(current);
                setOpen(true);
            } catch {
                // Silently ignore — the modal is purely a convenience prompt.
            }
        };

        void checkContract();

        return () => {
            cancelled = true;
        };
    }, [isPotentiallySignable, loading]);

    if (!contract) return null;

    const handleSignNow = () => {
        writeDismissedContractId(contract.contractId);
        setOpen(false);
        navigate(contractSignPath(contract.contractId));
    };

    const handleLater = () => {
        writeDismissedContractId(contract.contractId);
        setOpen(false);
    };

    const startDate = formatDate(contract.startDate);
    const functionLabel = (contract.functionName ?? "").trim();

    return (
        <Modal
            open={open}
            title="Your contract is ready to sign"
            onClose={handleLater}
            maxHeight={420}
            hideDefaultFooter
            footer={
                <>
                    <button type="button" className="btn btn_secondary" onClick={handleLater}>
                        Remind me later
                    </button>
                    <button type="button" className="btn" onClick={handleSignNow}>
                        Review and sign now
                    </button>
                </>
            }
        >
            <p style={{ marginTop: 0 }}>
                Your employer has prepared a contract for you. Please review the details and add
                your signature so we can finalize your onboarding.
            </p>
            {functionLabel || startDate ? (
                <div className="grid_two" style={{ marginTop: 12 }}>
                    {functionLabel ? (
                        <div className="info_item">
                            <div className="info_label">Function</div>
                            <div className="info_value">{functionLabel}</div>
                        </div>
                    ) : null}
                    {startDate ? (
                        <div className="info_item">
                            <div className="info_label">Start date</div>
                            <div className="info_value">{startDate}</div>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </Modal>
    );
}
