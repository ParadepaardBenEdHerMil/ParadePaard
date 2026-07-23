import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import { useAuth } from "../context/AuthContext";
import { UserServices, type FunctionResponseDTO } from "../services/user-service/UserServices";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminFunctions.css";

type FunctionDraft = {
    functionId: string | null;
    functionName: string;
    department: string;
    hourlyWage: string;
    active: boolean;
};

const EMPTY_DRAFT: FunctionDraft = {
    functionId: null,
    functionName: "",
    department: "",
    hourlyWage: "",
    active: true,
};

function formatWage(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) return "—";
    return `€${value.toFixed(2)}`;
}

export default function AdminFunctions() {
    const { permissions } = useAuth();
    const canManage = permissions.includes("CAN_MANAGE_FUNCTIONS");

    const [functions, setFunctions] = useState<FunctionResponseDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const [draft, setDraft] = useState<FunctionDraft | null>(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            setFunctions(await UserServices.getFunctions());
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load job functions.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load();
    }, [load]);

    const visible = useMemo(() => {
        const query = search.trim().toLowerCase();
        const sorted = [...functions].sort((a, b) => a.functionName.localeCompare(b.functionName));
        if (!query) return sorted;
        return sorted.filter((item) =>
            [item.functionName, item.department ?? ""].some((field) => field.toLowerCase().includes(query))
        );
    }, [functions, search]);

    const startCreate = () => {
        setFormError(null);
        setDraft({ ...EMPTY_DRAFT });
    };

    const startEdit = (item: FunctionResponseDTO) => {
        setFormError(null);
        setDraft({
            functionId: item.functionId,
            functionName: item.functionName,
            department: item.department ?? "",
            hourlyWage: item.hourlyWage === null || item.hourlyWage === undefined ? "" : String(item.hourlyWage),
            active: item.active !== false,
        });
    };

    const closeModal = () => {
        if (saving) return;
        setDraft(null);
        setFormError(null);
    };

    const handleSave = async (event: FormEvent) => {
        event.preventDefault();
        if (!draft) return;
        const name = draft.functionName.trim();
        if (!name) {
            setFormError("A function name is required.");
            return;
        }
        // hourly_wage is NOT NULL in contract-service, so a wage is required.
        const wageText = draft.hourlyWage.trim();
        const hourlyWage = wageText ? Number(wageText) : null;
        if (hourlyWage === null || Number.isNaN(hourlyWage) || hourlyWage < 0) {
            setFormError("Enter a valid hourly wage.");
            return;
        }
        const payload = {
            functionName: name,
            department: draft.department.trim() || null,
            hourlyWage,
            active: draft.active,
        };
        try {
            setSaving(true);
            setFormError(null);
            if (draft.functionId) {
                await UserServices.updateFunction(draft.functionId, payload);
            } else {
                await UserServices.createFunction(payload);
            }
            setDraft(null);
            await load();
        } catch (err: unknown) {
            setFormError(err instanceof Error ? err.message : "Failed to save the job function.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item: FunctionResponseDTO) => {
        if (!window.confirm(`Delete job function "${item.functionName}"?`)) return;
        try {
            setDeletingId(item.functionId);
            await UserServices.deleteFunction(item.functionId);
            await load();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to delete the job function.");
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
                    <main className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/management" />
                            <h1 className="pageTitle">Job functions</h1>
                            <p className="pageSubtitle">
                                The list of job functions/positions. These power the searchable job-function
                                picker when planning shifts.
                            </p>
                        </header>

                        <div className="adminDashboardCard">
                            <Card
                                title="Functions"
                                right={
                                    <div className="functionsToolbar">
                                        <input
                                            className="functionsSearch"
                                            type="search"
                                            value={search}
                                            placeholder="Search functions…"
                                            onChange={(event) => setSearch(event.target.value)}
                                        />
                                        <span className="functionsCount">
                                            {functions.length} function{functions.length === 1 ? "" : "s"}
                                        </span>
                                        {canManage ? (
                                            <button className="button" type="button" onClick={startCreate}>
                                                New function
                                            </button>
                                        ) : null}
                                    </div>
                                }
                            >
                                <div className="listContainer">
                                    <div className="listHeaderGrid gridFunctions">
                                        <div>Function</div>
                                        <div>Department</div>
                                        <div>Hourly wage</div>
                                        <div>Status</div>
                                        <div>{canManage ? "Actions" : ""}</div>
                                    </div>
                                    <div className="listScrollArea functionsScroll">
                                        {loading ? <div className="listEmpty">Loading job functions…</div> : null}
                                        {error ? <div className="listEmpty errorText">{error}</div> : null}
                                        {!loading && !error && visible.length === 0 ? (
                                            <div className="listEmpty">
                                                {search.trim()
                                                    ? "No functions match your search."
                                                    : "No job functions yet."}
                                            </div>
                                        ) : null}

                                        {!loading && !error
                                            ? visible.map((item) => (
                                                  <div key={item.functionId} className="listRowGrid gridFunctions">
                                                      <div className="cellMain">{item.functionName}</div>
                                                      <div className="cellSub" data-label="Department">
                                                          {item.department || "—"}
                                                      </div>
                                                      <div className="cellSub" data-label="Hourly wage">
                                                          {formatWage(item.hourlyWage)}/hr
                                                      </div>
                                                      <div
                                                          className={item.active === false ? "cellSub" : "cellOk"}
                                                          data-label="Status"
                                                      >
                                                          {item.active === false ? "Inactive" : "Active"}
                                                      </div>
                                                      <div className="functionsRowActions" data-label="">
                                                          {canManage ? (
                                                              <>
                                                                  <button
                                                                      className="buttonSecondary"
                                                                      type="button"
                                                                      onClick={() => startEdit(item)}
                                                                  >
                                                                      Edit
                                                                  </button>
                                                                  <button
                                                                      className="buttonDanger"
                                                                      type="button"
                                                                      onClick={() => void handleDelete(item)}
                                                                      disabled={deletingId === item.functionId}
                                                                  >
                                                                      {deletingId === item.functionId
                                                                          ? "Deleting…"
                                                                          : "Delete"}
                                                                  </button>
                                                              </>
                                                          ) : null}
                                                      </div>
                                                  </div>
                                              ))
                                            : null}
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </main>
                </div>
            </div>

            <Modal
                open={Boolean(draft)}
                onClose={closeModal}
                title={draft?.functionId ? "Edit job function" : "New job function"}
                hideDefaultFooter
                maxHeight={560}
            >
                {draft ? (
                    <form className="functionsForm" onSubmit={(event) => void handleSave(event)}>
                        <label className="functionsField">
                            <span>Function name</span>
                            <input
                                className="modal_input"
                                type="text"
                                value={draft.functionName}
                                placeholder="Example: Bar staff"
                                onChange={(event) =>
                                    setDraft((current) => (current ? { ...current, functionName: event.target.value } : current))
                                }
                            />
                        </label>
                        <label className="functionsField">
                            <span>Department</span>
                            <input
                                className="modal_input"
                                type="text"
                                value={draft.department}
                                placeholder="Optional"
                                onChange={(event) =>
                                    setDraft((current) => (current ? { ...current, department: event.target.value } : current))
                                }
                            />
                        </label>
                        <label className="functionsField">
                            <span>Hourly wage (€)</span>
                            <input
                                className="modal_input"
                                type="number"
                                min="0"
                                step="0.01"
                                value={draft.hourlyWage}
                                placeholder="Example: 19.50"
                                onChange={(event) =>
                                    setDraft((current) => (current ? { ...current, hourlyWage: event.target.value } : current))
                                }
                            />
                        </label>
                        <label className="functionsCheck">
                            <input
                                type="checkbox"
                                checked={draft.active}
                                onChange={(event) =>
                                    setDraft((current) => (current ? { ...current, active: event.target.checked } : current))
                                }
                            />
                            <span>Active (offered in the pickers)</span>
                        </label>

                        {formError ? <div className="functionsFormError">{formError}</div> : null}
                        <div className="functionsFormActions">
                            <button className="buttonSecondary" type="button" onClick={closeModal} disabled={saving}>
                                Cancel
                            </button>
                            <button className="button" type="submit" disabled={saving}>
                                {saving ? "Saving…" : "Save function"}
                            </button>
                        </div>
                    </form>
                ) : null}
            </Modal>
        </>
    );
}
