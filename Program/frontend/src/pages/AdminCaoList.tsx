import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { CaoServices, type CaoTemplateDTO } from "../services/user-service/CaoServices";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminUsers.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminCao.css";

export default function AdminCaoList() {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<CaoTemplateDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setTemplates(await CaoServices.getCaoTemplates());
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load CAO templates.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void load(); }, [load]);

    const handleDelete = async (caoId: string) => {
        if (!window.confirm("Delete this CAO template? This cannot be undone.")) return;
        try {
            setDeletingId(caoId);
            await CaoServices.deleteCaoTemplate(caoId);
            setTemplates((prev) => prev.filter((t) => t.caoId !== caoId));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to delete CAO template.");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/management" />
                            <div>
                                <h1 className="pageTitle">CAO Templates</h1>
                                <p className="pageSubtitle">
                                    Manage collective labor agreement presets for your company.
                                </p>
                            </div>
                        </header>

                        <div className="adminDashboardCard">
                            <Card title="CAO templates">
                                {loading ? (
                                    <div className="listEmpty">Loading...</div>
                                ) : error ? (
                                    <div className="listEmpty errorText">{error}</div>
                                ) : templates.length === 0 ? (
                                    <div className="caoEmpty">No CAO templates yet. Create one to get started.</div>
                                ) : (
                                    <div className="caoList">
                                        {templates.map((t) => {
                                            const varCount = t.variables?.length ?? 0;
                                            const dateRange = [
                                                t.effectiveFrom ? `From ${t.effectiveFrom}` : null,
                                                t.effectiveUntil ? `Until ${t.effectiveUntil}` : null,
                                            ].filter(Boolean).join(" – ");
                                            return (
                                                <div key={t.caoId} className="caoListItem">
                                                    <div className="caoListItemInfo">
                                                        <div className="caoListItemName">{t.name}</div>
                                                        {dateRange ? (
                                                            <div className="caoListItemDates">{dateRange}</div>
                                                        ) : null}
                                                    </div>
                                                    {t.sector ? (
                                                        <div className="caoListItemSector">{t.sector}</div>
                                                    ) : null}
                                                    <div className="caoListItemVarBadge" title={`${varCount} variable${varCount !== 1 ? "s" : ""}`}>
                                                        {varCount} var{varCount !== 1 ? "s" : ""}
                                                    </div>
                                                    <div className="caoListItemActions">
                                                        <button
                                                            type="button"
                                                            className="button buttonSecondary"
                                                            onClick={() => navigate(`/management/cao/${t.caoId}`)}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="button buttonDanger"
                                                            onClick={() => void handleDelete(t.caoId)}
                                                            disabled={deletingId === t.caoId}
                                                        >
                                                            {deletingId === t.caoId ? "Deleting..." : "Delete"}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="caoListFooter">
                                    <button
                                        type="button"
                                        className="button"
                                        onClick={() => navigate("/management/cao/new")}
                                    >
                                        New CAO template
                                    </button>
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
