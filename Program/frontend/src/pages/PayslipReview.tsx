import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { UserServices, type PayslipResponseDTO } from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/Payslips.css";

export default function PayslipReview() {
    const navigate = useNavigate();
    const [payslips, setPayslips] = useState<PayslipResponseDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const normalizeStatus = (status?: string | null) => (status ?? "RELEASED").toUpperCase();
    const formatStatus = (status?: string | null) => {
        const value = normalizeStatus(status);
        return value
            .split("_")
            .map((part) => part[0] + part.slice(1).toLowerCase())
            .join(" ");
    };

    const money = (n: number | null | undefined) =>
        new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(Number(n ?? 0));

    const downloadPayslipPdf = async (payslipId: string, filename: string) => {
        const blob = await UserServices.getPayslipPdf(payslipId);
        const url = URL.createObjectURL(blob);
        try {
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            a.remove();
        } finally {
            URL.revokeObjectURL(url);
        }
    };

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getPayslipsForReview();
            setPayslips(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load payslips for review");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const sorted = useMemo(() => {
        return [...payslips].sort((a, b) => {
            const da = a.availableToUserAt ?? "";
            const db = b.availableToUserAt ?? "";
            if (da !== db) return da.localeCompare(db);
            return (a.name ?? "").localeCompare(b.name ?? "");
        });
    }, [payslips]);

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="pageHeader">
                            <h1 className="pageTitle">Payslip Review</h1>
                        </header>
                        <div className="adminDashboardCard">
                            <Card
                                title="Pending Review"
                                right={
                                    <button className="button" onClick={() => void load()} disabled={loading}>
                                        Refresh
                                    </button>
                                }
                            >
                                <div className="listContainer">
                                    <div className="listHeaderGrid gridPayslipReview">
                                        <div>Name</div>
                                        <div>Period end</div>
                                        <div>Payout</div>
                                        <div>Hours</div>
                                        <div>Net</div>
                                        <div>Status</div>
                                        <div>Action</div>
                                    </div>

                                    <div className="listScrollArea" style={{ maxHeight: "65vh" }}>
                                        {loading ? <div className="listEmpty">Loading...</div> : null}
                                        {error ? <div className="listEmpty errorText">{error}</div> : null}

                                        {!loading && !error && sorted.length === 0 ? (
                                            <div className="listEmpty">No payslips pending review</div>
                                        ) : null}

                                        {!loading && !error
                                            ? sorted.map((p) => (
                                                  <div
                                                      key={p.payslipId}
                                                      className="listRowGrid gridPayslipReview clickableRow"
                                                      onClick={() => navigate(`/admin/payslip/${p.payslipId}`)}
                                                  >
                                                      <div className="cellMain">{p.name}</div>
                                                      <div className="cellSub">{formatDate(p.dateOfIssue)}</div>
                                                      <div className="cellSub">{formatDate(p.availableToUserAt)}</div>
                                                      <div className="cellDate">
                                                          {Number(p.totalHoursWorked ?? 0).toFixed(2)}
                                                      </div>
                                                      <div className="cellDate">{money(p.totalNetAmount)}</div>
                                                      <div className="cellSub">{formatStatus(p.status)}</div>
                                                      <div className="cellDate">
                                                          <button
                                                              className="linkButton"
                                                              type="button"
                                                              onClick={(event) => {
                                                                  event.stopPropagation();
                                                                  void downloadPayslipPdf(
                                                                      p.payslipId,
                                                                      `payslip_review_${p.weekBasedYear}_W${p.weekNumber}.pdf`
                                                                  );
                                                              }}
                                                          >
                                                              Download PDF
                                                          </button>
                                                      </div>
                                                  </div>
                                              ))
                                            : null}
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
