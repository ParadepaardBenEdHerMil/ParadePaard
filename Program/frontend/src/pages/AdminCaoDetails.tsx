import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { CaoServices, type CaoVariableDTO } from "../services/user-service/CaoServices";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminUsers.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminOnboardingReviewDetails.css";
import "../stylesheets/AdminCao.css";

const VALUE_TYPES = [
    { value: "PERCENTAGE", label: "Percentage (%)" },
    { value: "AMOUNT", label: "Amount (€)" },
    { value: "HOURS", label: "Hours" },
    { value: "MULTIPLIER", label: "Multiplier (x)" },
];

function emptyVariable(): CaoVariableDTO {
    return { code: "", label: "", valueType: "PERCENTAGE", value: null };
}

export default function AdminCaoDetails() {
    const navigate = useNavigate();
    const { caoId } = useParams();
    const isNew = caoId === "new";

    const [name, setName] = useState("");
    const [sector, setSector] = useState("");
    const [effectiveFrom, setEffectiveFrom] = useState("");
    const [effectiveUntil, setEffectiveUntil] = useState("");
    const [variables, setVariables] = useState<CaoVariableDTO[]>([]);

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (isNew || !caoId) return;
        try {
            setLoading(true);
            setError(null);
            const template = await CaoServices.getCaoTemplateById(caoId);
            setName(template.name);
            setSector(template.sector ?? "");
            setEffectiveFrom(template.effectiveFrom ?? "");
            setEffectiveUntil(template.effectiveUntil ?? "");
            setVariables(template.variables ?? []);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to load CAO template.");
        } finally {
            setLoading(false);
        }
    }, [caoId, isNew]);

    useEffect(() => { void load(); }, [load]);

    const handleSave = async () => {
        if (!name.trim()) { setError("CAO name is required."); return; }
        try {
            setSaving(true);
            setError(null);
            setSuccess(null);
            const payload = {
                name: name.trim(),
                sector: sector.trim() || null,
                effectiveFrom: effectiveFrom.trim() || null,
                effectiveUntil: effectiveUntil.trim() || null,
                variables,
            };
            if (isNew) {
                await CaoServices.createCaoTemplate(payload);
                setSuccess("CAO template created.");
                navigate("/management/cao");
            } else {
                await CaoServices.updateCaoTemplate(caoId!, payload);
                setSuccess("CAO template saved.");
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to save CAO template.");
        } finally {
            setSaving(false);
        }
    };

    const addVariable = () => setVariables((prev) => [...prev, emptyVariable()]);

    const removeVariable = (index: number) =>
        setVariables((prev) => prev.filter((_, i) => i !== index));

    const updateVariable = (index: number, patch: Partial<CaoVariableDTO>) =>
        setVariables((prev) => prev.map((v, i) => (i === index ? { ...v, ...patch } : v)));

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/management/cao" />
                            <div>
                                <h1 className="pageTitle">{isNew ? "New CAO template" : "Edit CAO template"}</h1>
                                <p className="pageSubtitle">
                                    Define the collective labor agreement variables for this preset.
                                </p>
                            </div>
                        </header>

                        <div className="adminDashboardCard adminOnboardingReviewDetails">
                            {loading ? (
                                <div className="listEmpty">Loading...</div>
                            ) : (
                                <>
                                    <Card title="Basic details" className="reviewCard">
                                        <div className="caoFormGrid">
                                            <label className="reviewField">
                                                <span className="reviewFieldLabel">
                                                    CAO name <span className="reviewRequired">*</span>
                                                </span>
                                                <input
                                                    className="uiSelect"
                                                    value={name}
                                                    onChange={(e) => setName(e.target.value)}
                                                    placeholder="e.g. Horeca CAO 2026"
                                                    disabled={saving}
                                                />
                                            </label>
                                            <label className="reviewField">
                                                <span className="reviewFieldLabel">Sector</span>
                                                <input
                                                    className="uiSelect"
                                                    value={sector}
                                                    onChange={(e) => setSector(e.target.value)}
                                                    placeholder="e.g. HORECA"
                                                    disabled={saving}
                                                />
                                            </label>
                                            <label className="reviewField">
                                                <span className="reviewFieldLabel">Effective from</span>
                                                <input
                                                    className="uiSelect"
                                                    type="date"
                                                    value={effectiveFrom}
                                                    onChange={(e) => setEffectiveFrom(e.target.value)}
                                                    disabled={saving}
                                                />
                                            </label>
                                            <label className="reviewField">
                                                <span className="reviewFieldLabel">Effective until</span>
                                                <input
                                                    className="uiSelect"
                                                    type="date"
                                                    value={effectiveUntil}
                                                    onChange={(e) => setEffectiveUntil(e.target.value)}
                                                    disabled={saving}
                                                />
                                            </label>
                                        </div>
                                    </Card>

                                    <Card title="CAO variables" className="reviewCard">
                                        <p style={{ fontSize: 13, color: "var(--color-text-secondary)", marginBottom: 12 }}>
                                            Define the variables for this CAO, such as holiday allowance, overtime rates, and pension contributions.
                                        </p>
                                        {variables.length === 0 ? (
                                            <div className="caoEmpty">No variables defined yet.</div>
                                        ) : (
                                            <div className="caoVariableList">
                                                {variables.map((variable, index) => (
                                                    <div key={index} className="caoVariableRow">
                                                        <div className="caoVariableField">
                                                            <span className="caoVariableFieldLabel">Code</span>
                                                            <input
                                                                className="uiSelect"
                                                                value={variable.code}
                                                                onChange={(e) => updateVariable(index, { code: e.target.value })}
                                                                placeholder="e.g. HOLIDAY_ALLOWANCE_PCT"
                                                                disabled={saving}
                                                            />
                                                        </div>
                                                        <div className="caoVariableField">
                                                            <span className="caoVariableFieldLabel">Label</span>
                                                            <input
                                                                className="uiSelect"
                                                                value={variable.label}
                                                                onChange={(e) => updateVariable(index, { label: e.target.value })}
                                                                placeholder="e.g. Vakantietoeslag"
                                                                disabled={saving}
                                                            />
                                                        </div>
                                                        <div className="caoVariableField">
                                                            <span className="caoVariableFieldLabel">Type</span>
                                                            <select
                                                                className="uiSelect"
                                                                value={variable.valueType}
                                                                onChange={(e) => updateVariable(index, { valueType: e.target.value })}
                                                                disabled={saving}
                                                            >
                                                                {VALUE_TYPES.map((vt) => (
                                                                    <option key={vt.value} value={vt.value}>{vt.label}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="caoVariableField">
                                                            <span className="caoVariableFieldLabel">Value</span>
                                                            <input
                                                                className="uiSelect"
                                                                type="number"
                                                                value={variable.value ?? ""}
                                                                onChange={(e) =>
                                                                    updateVariable(index, {
                                                                        value: e.target.value ? Number(e.target.value) : null,
                                                                    })
                                                                }
                                                                placeholder="0"
                                                                disabled={saving}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            className="button buttonDanger caoVariableRemove"
                                                            onClick={() => removeVariable(index)}
                                                            disabled={saving}
                                                            title="Remove variable"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="caoActionsRow">
                                            <button
                                                type="button"
                                                className="button buttonSecondary"
                                                onClick={addVariable}
                                                disabled={saving}
                                            >
                                                Add variable
                                            </button>
                                        </div>
                                    </Card>

                                    {error ? <div className="reviewActionError">{error}</div> : null}
                                    {success ? <div className="helperText">{success}</div> : null}

                                    <div className="reviewActions">
                                        <button
                                            type="button"
                                            className="button"
                                            onClick={() => void handleSave()}
                                            disabled={saving}
                                        >
                                            {saving ? "Saving..." : isNew ? "Create CAO template" : "Save changes"}
                                        </button>
                                        <button
                                            type="button"
                                            className="button buttonSecondary"
                                            onClick={() => navigate("/management/cao")}
                                            disabled={saving}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
