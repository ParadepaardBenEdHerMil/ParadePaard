import { useMemo, useState } from "react";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import {
    DEFAULT_HORECA_JOB_PRESETS,
    HORECA_CAO_OPTIONS,
    HORECA_EMPLOYER_PREMIUM_RULES,
    HORECA_PAYROLL_VARIABLES,
    HORECA_RULE_SOURCES,
    HORECA_WAGE_RULES,
    type ContractType,
    type HolidayAllowanceMode,
    type JobPreset,
    type PayrollPeriod,
    type PayrollRuleSource,
} from "../data/horecaPayrollRules";
import {
    calculatePayrollCalculator,
    calculateMonthlyHours,
    formatSourceLabel,
    getHorecaRequiredHourlyWage,
    getPayrollVariableNumber,
    loadHorecaJobPresets,
    resetHorecaJobPresets,
    saveHorecaJobPresets,
    validateContractPayrollSettings,
} from "../utils/horecaPayrollRules";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminUsers.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/Settings.css";
import "../stylesheets/HorecaPayrollRules.css";

type ContractRuleDraft = {
    employeeDateOfBirth: string;
    caoId: string;
    jobPresetId: string;
    jobTitle: string;
    jobFunction: string;
    functionGroup: string;
    contractType: ContractType;
    startDate: string;
    endDate: string;
    hoursPerWeek: number;
    payrollPeriod: PayrollPeriod;
    hourlyWage: number;
    monthlyWage: number;
    loonheffingskorting: boolean | null;
    pensionApplicable: boolean | null;
    holidayAllowanceMode: HolidayAllowanceMode;
    vacationBuildUpApplicable: boolean;
    isManualWageOverride: boolean;
    manualWageOverrideReason: string;
};

type PayrollCalculatorDraft = {
    employeeDateOfBirth: string;
    startDate: string;
    functionGroup: string;
    contractType: ContractType;
    hoursPerWeek: number;
    hourlyWage: number;
    loonheffingskorting: boolean;
    pensionApplicable: boolean;
};

type PresetWizardStep = "details" | "rules" | "notes";

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function money(value: number): string {
    return currencyFormatter.format(value);
}

function pct(value: number): string {
    return `${numberFormatter.format(value)}%`;
}

function makePresetId(name: string): string {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
    return `${slug || "job-preset"}-${Date.now()}`;
}

function createPresetDraft(): JobPreset {
    return {
        ...DEFAULT_HORECA_JOB_PRESETS[0],
        id: "",
        presetName: "",
        jobTitle: "",
        jobFunction: "",
        adminNotes: "",
    };
}

function sourceById(sourceId: string): PayrollRuleSource | null {
    return HORECA_RULE_SOURCES.find((source) => source.id === sourceId) ?? null;
}

function PencilIcon() {
    return (
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path
                d="M4.25 13.75V15.75H6.25L14.35 7.65L12.35 5.65L4.25 13.75Z"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
            />
            <path
                d="M10.95 7.05L12.95 9.05"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
            />
            <path
                d="M11.85 4.75L13.25 3.35C13.72 2.88 14.48 2.88 14.95 3.35L16.65 5.05C17.12 5.52 17.12 6.28 16.65 6.75L15.25 8.15"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
            />
        </svg>
    );
}

function DisableIcon() {
    return (
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path
                d="M5.4 14.6L14.6 5.4"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.6"
            />
        </svg>
    );
}

function EnableIcon() {
    return (
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path
                d="M7.2 10.1L9 11.9L12.8 8.1"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
            />
        </svg>
    );
}

function TrashIcon() {
    return (
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <path d="M5.75 6.25H14.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
            <path
                d="M7.25 6.25V4.75C7.25 4.34 7.59 4 8 4H12C12.41 4 12.75 4.34 12.75 4.75V6.25"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
            />
            <path
                d="M6.75 6.25V14.25C6.75 14.94 7.31 15.5 8 15.5H12C12.69 15.5 13.25 14.94 13.25 14.25V6.25"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.6"
            />
            <path d="M8.75 8.5V13" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
            <path d="M11.25 8.5V13" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
        </svg>
    );
}

export default function HorecaPayrollRules() {
    const [jobPresets, setJobPresets] = useState<JobPreset[]>(() => loadHorecaJobPresets());
    const [presetDraft, setPresetDraft] = useState<JobPreset>(() => createPresetDraft());
    const [presetError, setPresetError] = useState<string | null>(null);
    const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
    const [presetStep, setPresetStep] = useState<PresetWizardStep>("details");
    const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

    const activePresets = useMemo(() => jobPresets.filter((preset) => preset.isActive), [jobPresets]);
    const firstPreset = activePresets[0] ?? DEFAULT_HORECA_JOB_PRESETS[0];

    const [contractDraft, setContractDraft] = useState<ContractRuleDraft>(() => ({
        employeeDateOfBirth: "1998-02-10",
        caoId: HORECA_CAO_OPTIONS[0].id,
        jobPresetId: firstPreset.id,
        jobTitle: firstPreset.jobTitle,
        jobFunction: firstPreset.jobFunction,
        functionGroup: firstPreset.functionGroup,
        contractType: firstPreset.defaultContractType,
        startDate: "2026-01-01",
        endDate: "",
        hoursPerWeek: firstPreset.defaultHoursPerWeek || 38,
        payrollPeriod: firstPreset.defaultPayrollPeriod,
        hourlyWage: firstPreset.defaultHourlyWage,
        monthlyWage: firstPreset.defaultMonthlyWage,
        loonheffingskorting: true,
        pensionApplicable: firstPreset.pensionApplicable,
        holidayAllowanceMode: firstPreset.holidayAllowanceMode,
        vacationBuildUpApplicable: firstPreset.vacationBuildUpApplicable,
        isManualWageOverride: false,
        manualWageOverrideReason: "",
    }));

    const selectedSource = selectedSourceId ? sourceById(selectedSourceId) : null;
    const holidayAllowancePct = getPayrollVariableNumber("holidayAllowancePercentage");
    const vacationBuildUp = getPayrollVariableNumber("vacationBuildUpPerPaidHour");
    const fullTimeWeeklyHours = getPayrollVariableNumber("normalFullTimeWeeklyHours");
    const fullTimeMonthlyHours = getPayrollVariableNumber("normalFullTimeMonthlyHours");
    const pensionEmployeePct = getPayrollVariableNumber("pensionPremiumEmployee");
    const pensionEmployerPct = getPayrollVariableNumber("pensionPremiumEmployer");
    const selectedPreset = jobPresets.find((preset) => preset.id === contractDraft.jobPresetId) ?? null;
    const validation = validateContractPayrollSettings({
        employeeDateOfBirth: contractDraft.employeeDateOfBirth,
        startDate: contractDraft.startDate,
        caoId: contractDraft.caoId,
        jobPresetId: contractDraft.jobPresetId,
        contractType: contractDraft.contractType,
        functionGroup: contractDraft.functionGroup,
        hourlyWage: contractDraft.hourlyWage,
        loonheffingskorting: contractDraft.loonheffingskorting,
        pensionApplicable: contractDraft.pensionApplicable,
        isManualWageOverride: contractDraft.isManualWageOverride,
        manualWageOverrideReason: contractDraft.manualWageOverrideReason,
    });
    const [calculatorDraft, setCalculatorDraft] = useState<PayrollCalculatorDraft>(() => ({
        employeeDateOfBirth: "1998-02-10",
        startDate: "2026-01-01",
        functionGroup: "I+II",
        contractType: "FULL_TIME",
        hoursPerWeek: 38,
        hourlyWage: 14.71,
        loonheffingskorting: true,
        pensionApplicable: true,
    }));
    const [calculatorResult, setCalculatorResult] = useState(() => calculatePayrollCalculator(calculatorDraft));
    const calculatorMonthlyHours =
        calculatorDraft.contractType === "FULL_TIME"
            ? calculateMonthlyHours(38)
            : calculateMonthlyHours(calculatorDraft.hoursPerWeek);
    const calculatorRequiredWage = getHorecaRequiredHourlyWage({
        dateOfBirth: calculatorDraft.employeeDateOfBirth,
        startDate: calculatorDraft.startDate,
        functionGroup: calculatorDraft.functionGroup,
    });
    const calculatorWageWarning =
        calculatorRequiredWage && calculatorDraft.hourlyWage < calculatorRequiredWage.hourlyWage
            ? `Entered wage is below the horeca minimum of ${money(calculatorRequiredWage.hourlyWage)} for this age and function group.`
            : null;

    const sourceButton = (sourceId: string, pageNumber?: string) => (
        <button
            type="button"
            className="sourcePill"
            onClick={() => setSelectedSourceId(sourceId)}
        >
            {formatSourceLabel(sourceId, pageNumber)}
        </button>
    );

    const savePresets = (nextPresets: JobPreset[]) => {
        setJobPresets(nextPresets);
        saveHorecaJobPresets(nextPresets);
    };

    const updateCalculatorDraft = <K extends keyof PayrollCalculatorDraft>(key: K, value: PayrollCalculatorDraft[K]) => {
        setCalculatorDraft((prev) => ({ ...prev, [key]: value }));
    };

    const handleGenerateCalculatorOutput = () => {
        setCalculatorResult(calculatePayrollCalculator(calculatorDraft));
    };

    const openCreatePresetModal = () => {
        setPresetDraft(createPresetDraft());
        setPresetError(null);
        setPresetStep("details");
        setIsPresetModalOpen(true);
    };

    const openEditPresetModal = (preset: JobPreset) => {
        setPresetDraft({ ...preset });
        setPresetError(null);
        setPresetStep("details");
        setIsPresetModalOpen(true);
    };

    const closePresetModal = () => {
        setIsPresetModalOpen(false);
        setPresetDraft(createPresetDraft());
        setPresetError(null);
        setPresetStep("details");
    };

    const updatePresetDraft = <K extends keyof JobPreset>(key: K, value: JobPreset[K]) => {
        setPresetDraft((prev) => ({ ...prev, [key]: value }));
    };

    const handleSavePreset = () => {
        if (!presetDraft.presetName.trim()) {
            setPresetError("Preset name is required.");
            return;
        }
        if (!presetDraft.jobTitle.trim() || !presetDraft.jobFunction.trim()) {
            setPresetError("Job title and job function are required.");
            return;
        }
        if (!presetDraft.functionGroup.trim()) {
            setPresetError("Function group is required.");
            return;
        }
        if (!Number.isFinite(presetDraft.defaultHourlyWage) || presetDraft.defaultHourlyWage <= 0) {
            setPresetError("Default hourly wage must be higher than zero.");
            return;
        }

        const nextPreset = {
            ...presetDraft,
            id: presetDraft.id || makePresetId(presetDraft.presetName),
            sector: "horeca" as const,
            sourceId: presetDraft.sourceId || "loontabel-2026-01-01",
        };
        const exists = jobPresets.some((preset) => preset.id === nextPreset.id);
        const nextPresets = exists
            ? jobPresets.map((preset) => (preset.id === nextPreset.id ? nextPreset : preset))
            : [...jobPresets, nextPreset];

        savePresets(nextPresets);
        closePresetModal();
    };

    const handleTogglePresetActive = (presetId: string) => {
        savePresets(jobPresets.map((item) => (item.id === presetId ? { ...item, isActive: !item.isActive } : item)));
    };

    const handleDeletePreset = (presetId: string) => {
        savePresets(jobPresets.filter((preset) => preset.id !== presetId));
        setContractDraft((prev) => (prev.jobPresetId === presetId ? { ...prev, jobPresetId: "" } : prev));
        if (presetDraft.id === presetId) {
            closePresetModal();
        }
    };

    const applyPresetToContract = (presetId: string) => {
        const preset = jobPresets.find((item) => item.id === presetId);
        if (!preset) {
            setContractDraft((prev) => ({ ...prev, jobPresetId: "" }));
            return;
        }
        setContractDraft((prev) => ({
            ...prev,
            jobPresetId: preset.id,
            jobTitle: preset.jobTitle,
            jobFunction: preset.jobFunction,
            functionGroup: preset.functionGroup,
            contractType: preset.defaultContractType,
            hoursPerWeek: preset.defaultContractType === "FULL_TIME" ? 38 : preset.defaultHoursPerWeek,
            payrollPeriod: preset.defaultPayrollPeriod,
            hourlyWage: preset.defaultHourlyWage,
            monthlyWage: preset.defaultMonthlyWage,
            pensionApplicable: preset.pensionApplicable,
            holidayAllowanceMode: preset.holidayAllowanceMode,
            vacationBuildUpApplicable: preset.vacationBuildUpApplicable,
            isManualWageOverride: false,
            manualWageOverrideReason: "",
        }));
    };

    const expectedMonthlyHours =
        contractDraft.contractType === "ZERO_HOURS" && contractDraft.hoursPerWeek === 0
            ? 0
            : calculateMonthlyHours(contractDraft.contractType === "FULL_TIME" ? 38 : contractDraft.hoursPerWeek);

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage horecaRulesPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <main className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/management" />
                            <div>
                                <h1 className="pageTitle">Horeca Payroll and Contract Rules</h1>
                                <p className="pageSubtitle">
                                    Manage source-backed horeca contract values before employment contracts are generated.
                                </p>
                            </div>
                        </header>

                        <div className="horecaRulesLayout">
                            <section className="horecaRulesMain">
                                <Card title="Overview" className="horecaRulesCard">
                                    <div className="horecaCardBody">
                                        <div className="ruleValueGrid">
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Sector</span>
                                                <strong>Horeca only</strong>
                                                <span className="ruleValueNote">Other sectors can be added later.</span>
                                            </div>
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">CAO</span>
                                                <strong>{HORECA_CAO_OPTIONS[0].name}</strong>
                                                {sourceButton(HORECA_CAO_OPTIONS[0].sourceId, "12")}
                                            </div>
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Full time</span>
                                                <strong>
                                                    {fullTimeWeeklyHours} hours per week, {fullTimeMonthlyHours} hours per month
                                                </strong>
                                                {sourceButton("horeca-cao-2025-2026", "12")}
                                            </div>
                                        </div>
                                        <p className="businessFlowText">
                                            The employee works at the horeca client. The payroll company is the legal employer.
                                            The horeca client sends or approves worked hours. The payroll company uses the
                                            contract settings and horeca CAO rules to calculate gross wage, withholds employee
                                            payroll tax and employee pension, pays net wage to the employee, pays payroll tax and
                                            employer premiums to the Belastingdienst, pays pension premium to Pensioenfonds
                                            Horeca en Catering, and invoices the horeca client based on the contract terms.
                                        </p>
                                    </div>
                                </Card>

                                <Card title="Horeca CAO source documents" className="horecaRulesCard">
                                    <div className="tableScroll">
                                        <table className="rulesTable">
                                            <thead>
                                                <tr>
                                                    <th>Document</th>
                                                    <th>Used for</th>
                                                    <th>Effective</th>
                                                    <th>Page</th>
                                                    <th>Source</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {HORECA_RULE_SOURCES.map((source) => (
                                                    <tr key={source.id}>
                                                        <td>
                                                            <strong>{source.documentName}</strong>
                                                            <span>{source.sourceName}</span>
                                                        </td>
                                                        <td>{source.sourceNote}</td>
                                                        <td>
                                                            {source.effectiveFrom}
                                                            {source.effectiveTo ? ` to ${source.effectiveTo}` : ""}
                                                        </td>
                                                        <td>{source.pageNumber}</td>
                                                        <td>
                                                            <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                                                                Open document
                                                            </a>
                                                            {sourceButton(source.id)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>

                                <Card
                                    title="Job presets"
                                    className="horecaRulesCard"
                                    right={
                                        <div className="cardHeaderActions">
                                            <button
                                                type="button"
                                                className="button buttonSecondary"
                                                onClick={() => {
                                                    const defaults = resetHorecaJobPresets();
                                                    setJobPresets(defaults);
                                                    closePresetModal();
                                                }}
                                            >
                                                Reset defaults
                                            </button>
                                            <button
                                                type="button"
                                                className="button"
                                                aria-label="Create job preset"
                                                onClick={openCreatePresetModal}
                                            >
                                                Create job preset
                                            </button>
                                        </div>
                                    }
                                >
                                    <div className="horecaCardBody">
                                        <div className="sectionIntro">
                                            Job presets are reusable templates for horeca roles. Selecting a preset fills the
                                            contract title, function, function group, wage, contract type, payroll period,
                                            pension setting, holiday allowance setting, and vacation buildup rule.
                                        </div>
                                        <div className="tableScroll">
                                            <table className="rulesTable">
                                                <thead>
                                                    <tr>
                                                        <th>Preset</th>
                                                        <th>Function</th>
                                                        <th>Group</th>
                                                        <th>Wage</th>
                                                        <th>Contract</th>
                                                        <th>Payroll</th>
                                                        <th>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {jobPresets.map((preset) => (
                                                        <tr key={preset.id}>
                                                            <td>
                                                                <strong>{preset.presetName}</strong>
                                                                <span>{preset.jobTitle}</span>
                                                            </td>
                                                            <td>{preset.jobFunction}</td>
                                                            <td>{preset.functionGroup}</td>
                                                            <td>
                                                                {money(preset.defaultHourlyWage)} hourly
                                                                <span>{money(preset.defaultMonthlyWage)} monthly</span>
                                                                {sourceButton(preset.sourceId, "1")}
                                                            </td>
                                                            <td>{preset.defaultContractType.replace("_", " ").toLowerCase()}</td>
                                                            <td>
                                                                {preset.defaultPayrollPeriod}
                                                                <span>
                                                                    Pension {preset.pensionApplicable ? "yes" : "no"}, holiday allowance{" "}
                                                                    {preset.holidayAllowanceMode === "RESERVED" ? "reserved" : "paid each period"}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                <div className="tableActions">
                                                                    <button
                                                                        type="button"
                                                                        className="tableActionIconButton"
                                                                        aria-label={`Edit preset ${preset.presetName}`}
                                                                        title={`Edit ${preset.presetName}`}
                                                                        onClick={() => openEditPresetModal(preset)}
                                                                    >
                                                                        <PencilIcon />
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="tableActionIconButton"
                                                                        aria-label={`${preset.isActive ? "Disable" : "Enable"} preset ${preset.presetName}`}
                                                                        title={`${preset.isActive ? "Disable" : "Enable"} ${preset.presetName}`}
                                                                        onClick={() => handleTogglePresetActive(preset.id)}
                                                                    >
                                                                        {preset.isActive ? <DisableIcon /> : <EnableIcon />}
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        className="tableActionIconButton tableActionIconButton--danger"
                                                                        aria-label={`Delete preset ${preset.presetName}`}
                                                                        title={`Delete ${preset.presetName}`}
                                                                        onClick={() => handleDeletePreset(preset.id)}
                                                                    >
                                                                        <TrashIcon />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </Card>

                                <Card title="Contract settings" className="horecaRulesCard">
                                    <div className="horecaCardBody">
                                        <div className="sectionIntro">
                                            This sample admin contract setup shows how the final onboarding review should separate
                                            employee-provided personal data from admin-selected legal and payroll settings.
                                        </div>
                                        <div className="rulesFormGrid">
                                            <label className="rulesField">
                                                <span>Horeca CAO</span>
                                                <select
                                                    className="uiSelect"
                                                    value={contractDraft.caoId}
                                                    onChange={(event) =>
                                                        setContractDraft((prev) => ({ ...prev, caoId: event.target.value }))
                                                    }
                                                >
                                                    {HORECA_CAO_OPTIONS.map((cao) => (
                                                        <option key={cao.id} value={cao.id}>
                                                            {cao.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {sourceButton("horeca-cao-2025-2026", "12")}
                                            </label>
                                            <label className="rulesField">
                                                <span>Job preset</span>
                                                <select
                                                    className="uiSelect"
                                                    value={contractDraft.jobPresetId}
                                                    onChange={(event) => applyPresetToContract(event.target.value)}
                                                >
                                                    <option value="">Select a preset</option>
                                                    {activePresets.map((preset) => (
                                                        <option key={preset.id} value={preset.id}>
                                                            {preset.presetName}
                                                        </option>
                                                    ))}
                                                </select>
                                                {selectedPreset ? sourceButton(selectedPreset.sourceId, "1") : null}
                                            </label>
                                            <label className="rulesField">
                                                <span>Contract type</span>
                                                <select
                                                    className="uiSelect"
                                                    value={contractDraft.contractType}
                                                    onChange={(event) =>
                                                        setContractDraft((prev) => ({
                                                            ...prev,
                                                            contractType: event.target.value as ContractType,
                                                            hoursPerWeek:
                                                                event.target.value === "FULL_TIME" ? 38 : prev.hoursPerWeek,
                                                        }))
                                                    }
                                                >
                                                    <option value="FULL_TIME">Full time</option>
                                                    <option value="PART_TIME">Part time</option>
                                                    <option value="ZERO_HOURS">Zero hours</option>
                                                </select>
                                            </label>
                                            <label className="rulesField">
                                                <span>Hours per week</span>
                                                <input
                                                    className="uiSelect"
                                                    type="number"
                                                    min="0"
                                                    step="0.25"
                                                    value={contractDraft.contractType === "FULL_TIME" ? 38 : contractDraft.hoursPerWeek}
                                                    disabled={contractDraft.contractType === "FULL_TIME"}
                                                    onChange={(event) =>
                                                        setContractDraft((prev) => ({
                                                            ...prev,
                                                            hoursPerWeek: Number(event.target.value),
                                                        }))
                                                    }
                                                />
                                                {sourceButton("horeca-cao-2025-2026", "12")}
                                            </label>
                                            <label className="rulesField">
                                                <span>Gross wage</span>
                                                <input
                                                    className="uiSelect"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={calculatorDraft.grossWage}
                                                    onChange={(event) =>
                                                        updateCalculatorDraft("grossWage", Number(event.target.value))
                                                    }
                                                />
                                            </label>
                                            <div className="rulesField rulesFieldFull">
                                                <span>Gross hourly wage *</span>
                                                <input
                                                    className="uiSelect"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={contractDraft.hourlyWage}
                                                    onChange={(event) =>
                                                        setContractDraft((prev) => ({
                                                            ...prev,
                                                            hourlyWage: Number(event.target.value),
                                                            isManualWageOverride: true,
                                                    }))
                                                }
                                                />
                                                {sourceButton("loontabel-2026-01-01", "1")}
                                                <span className="ruleValueNote">Manual wage override reason</span>
                                                <input
                                                    className="uiSelect"
                                                    value={contractDraft.manualWageOverrideReason}
                                                    onChange={(event) =>
                                                        setContractDraft((prev) => ({
                                                            ...prev,
                                                            manualWageOverrideReason: event.target.value,
                                                        }))
                                                    }
                                                    placeholder="Required when wage is overridden"
                                                />
                                            </div>
                                            <label className="rulesField">
                                                <span>Payroll period</span>
                                                <select
                                                    className="uiSelect"
                                                    value={contractDraft.payrollPeriod}
                                                    onChange={(event) =>
                                                        setContractDraft((prev) => ({
                                                            ...prev,
                                                            payrollPeriod: event.target.value as PayrollPeriod,
                                                        }))
                                                    }
                                                >
                                                    <option value="MONTHLY">Monthly</option>
                                                    <option value="WEEKLY">Weekly</option>
                                                    <option value="BIWEEKLY">Bi-weekly</option>
                                                    <option value="FOUR_WEEKLY">Four-weekly</option>
                                                </select>
                                            </label>
                                        </div>
                                        <div className="ruleValueGrid">
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Expected monthly hours</span>
                                                <strong>{numberFormatter.format(expectedMonthlyHours)}</strong>
                                                {sourceButton("horeca-cao-2025-2026", "12")}
                                            </div>
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Holiday allowance</span>
                                                <strong>
                                                    {pct(holidayAllowancePct)}{" "}
                                                    {contractDraft.holidayAllowanceMode === "RESERVED"
                                                        ? "reserved"
                                                        : "paid each period"}
                                                </strong>
                                                {sourceButton("horeca-cao-2025-2026", "32")}
                                            </div>
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Vacation buildup</span>
                                                <strong>{vacationBuildUp} vacation hour per paid hour</strong>
                                                {sourceButton("horeca-cao-2025-2026", "23")}
                                            </div>
                                        </div>
                                        {validation.blockingErrors.length || validation.warnings.length ? (
                                            <div className="rulesValidation">
                                                {validation.blockingErrors.map((item) => (
                                                    <div key={item} className="rulesValidationError">
                                                        {item}
                                                    </div>
                                                ))}
                                                {validation.warnings.map((item) => (
                                                    <div key={item} className="rulesValidationWarning">
                                                        {item}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                </Card>

                                <Card title="Wage rules" className="horecaRulesCard">
                                    <div className="tableScroll">
                                        <table className="rulesTable">
                                            <thead>
                                                <tr>
                                                    <th>Year</th>
                                                    <th>Age group</th>
                                                    <th>Function group</th>
                                                    <th>Monthly</th>
                                                    <th>Weekly</th>
                                                    <th>Hourly wage</th>
                                                    <th>Source</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {HORECA_WAGE_RULES.map((rule) => (
                                                    <tr key={rule.id}>
                                                        <td>{rule.year}</td>
                                                        <td>{rule.ageGroup}</td>
                                                        <td>{rule.functionGroup}</td>
                                                        <td>{money(rule.monthlyWage)}</td>
                                                        <td>{money(rule.weeklyWage)}</td>
                                                        <td>{money(rule.hourlyWage)}</td>
                                                        <td>{sourceButton(rule.sourceId, rule.pageNumber)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>

                                <Card title="Tax and payroll rules" className="horecaRulesCard">
                                    <div className="horecaCardBody">
                                        <div className="ruleValueGrid">
                                            {HORECA_EMPLOYER_PREMIUM_RULES.map((rule) => (
                                                <div className="ruleValueCard" key={rule.id}>
                                                    <span className="ruleValueLabel">{rule.premiumName}</span>
                                                    <strong>{pct(rule.percentage)}</strong>
                                                    <span className="ruleValueNote">{rule.conditionName}</span>
                                                    {sourceButton(rule.sourceId, rule.pageNumber)}
                                                </div>
                                            ))}
                                            {HORECA_PAYROLL_VARIABLES.filter((variable) =>
                                                variable.variableName.startsWith("monthlyPayrollTax")
                                            ).map((variable) => (
                                                <div className="ruleValueCard" key={variable.id}>
                                                    <span className="ruleValueLabel">{variable.displayName}</span>
                                                    <strong>{money(Number(variable.value))}</strong>
                                                    <span className="ruleValueNote">{variable.meaning}</span>
                                                    {sourceButton(variable.sourceId, variable.pageNumber)}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Card>

                                <Card title="Pension rules" className="horecaRulesCard">
                                    <div className="horecaCardBody">
                                        <div className="ruleValueGrid">
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Total pension premium</span>
                                                <strong>{pct(pensionEmployeePct + pensionEmployerPct)}</strong>
                                                {sourceButton("phenc-pensioenpremie", "Web page")}
                                            </div>
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Employee part</span>
                                                <strong>{pct(pensionEmployeePct)}</strong>
                                                {sourceButton("phenc-pensioenpremie", "Web page")}
                                            </div>
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Employer part</span>
                                                <strong>{pct(pensionEmployerPct)}</strong>
                                                {sourceButton("phenc-pensioenpremie", "Web page")}
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                <Card title="Example contract population" className="horecaRulesCard">
                                    <div className="horecaCardBody">
                                        <div className="contractPopulationGrid">
                                            <div>
                                                <h3>Employee provided information</h3>
                                                <ul className="rulesList">
                                                    <li>Name, date of birth, address, email, and phone</li>
                                                    <li>Bank account, nationality, identification, and emergency contact</li>
                                                    <li>Tax credit choice and other personal onboarding details</li>
                                                </ul>
                                            </div>
                                            <div>
                                                <h3>Admin selected contract information</h3>
                                                <ul className="rulesList">
                                                    <li>CAO, job preset, job title, job function, and function group</li>
                                                    <li>Contract type, start date, end date, wage, hours, and payroll period</li>
                                                    <li>Pension, holiday allowance, vacation buildup, and billing settings</li>
                                                </ul>
                                            </div>
                                        </div>
                                        <div className="sourceDetailsBlock">
                                            <h3>Source details</h3>
                                            <div className="rulesRows">
                                                <div>
                                                    <span>Hourly wage</span>
                                                    <strong>{money(14.71)}</strong>
                                                    {sourceButton("loontabel-2026-01-01", "1")}
                                                </div>
                                                <div>
                                                    <span>Holiday allowance</span>
                                                    <strong>{pct(8)}</strong>
                                                    {sourceButton("horeca-cao-2025-2026", "32")}
                                                </div>
                                                <div>
                                                    <span>Full time hours</span>
                                                    <strong>38 hours per week, 164.67 hours per month</strong>
                                                    {sourceButton("horeca-cao-2025-2026", "12")}
                                                </div>
                                                <div>
                                                    <span>Pension premium</span>
                                                    <strong>16.8% total, 8.4% employee and 8.4% employer</strong>
                                                    {sourceButton("phenc-pensioenpremie", "Web page")}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                <Card title="Payroll calculator" className="horecaRulesCard">
                                    <div className="horecaCardBody">
                                        <div className="sectionIntro">
                                            Enter the employee and contract context. The calculator derives horeca tax,
                                            pension, holiday allowance, vacation buildup, and employer premiums from the
                                            official source-backed rules. Only the wage is meant to be adjusted manually.
                                        </div>
                                        <div className="ruleValueGrid">
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Derived monthly hours</span>
                                                <strong>{numberFormatter.format(calculatorMonthlyHours)} hours</strong>
                                                {sourceButton("horeca-cao-2025-2026", "12")}
                                            </div>
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Required horeca hourly wage</span>
                                                <strong>
                                                    {calculatorRequiredWage ? money(calculatorRequiredWage.hourlyWage) : "Not available"}
                                                </strong>
                                                {sourceButton("loontabel-2026-01-01", "1")}
                                            </div>
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Tax source</span>
                                                <strong>Belastingdienst monthly wage tax table 2026</strong>
                                                {sourceButton("witte-maandloon-2026-01-01", "15")}
                                            </div>
                                        </div>
                                        <div className="rulesFormGrid">
                                            <label className="rulesField">
                                                <span>Employee date of birth</span>
                                                <input
                                                    className="uiSelect"
                                                    type="date"
                                                    value={calculatorDraft.employeeDateOfBirth}
                                                    onChange={(event) =>
                                                        updateCalculatorDraft("employeeDateOfBirth", event.target.value)
                                                    }
                                                />
                                            </label>
                                            <label className="rulesField">
                                                <span>Start date</span>
                                                <input
                                                    className="uiSelect"
                                                    type="date"
                                                    value={calculatorDraft.startDate}
                                                    onChange={(event) =>
                                                        updateCalculatorDraft("startDate", event.target.value)
                                                    }
                                                />
                                            </label>
                                            <label className="rulesField">
                                                <span>Function group</span>
                                                <select
                                                    className="uiSelect"
                                                    value={calculatorDraft.functionGroup}
                                                    onChange={(event) =>
                                                        updateCalculatorDraft("functionGroup", event.target.value)
                                                    }
                                                >
                                                    <option value="I+II">I plus II</option>
                                                </select>
                                            </label>
                                            <label className="rulesField">
                                                <span>Contract type</span>
                                                <select
                                                    className="uiSelect"
                                                    value={calculatorDraft.contractType}
                                                    onChange={(event) => {
                                                        const nextContractType = event.target.value as ContractType;
                                                        setCalculatorDraft((prev) => ({
                                                            ...prev,
                                                            contractType: nextContractType,
                                                            hoursPerWeek: nextContractType === "FULL_TIME" ? 38 : prev.hoursPerWeek,
                                                        }));
                                                    }}
                                                >
                                                    <option value="FULL_TIME">Full time</option>
                                                    <option value="PART_TIME">Part time</option>
                                                    <option value="ZERO_HOURS">Zero hours</option>
                                                </select>
                                            </label>
                                            <label className="rulesField">
                                                <span>Hours per week</span>
                                                <input
                                                    className="uiSelect"
                                                    type="number"
                                                    min="0"
                                                    step="0.25"
                                                    value={calculatorDraft.hoursPerWeek}
                                                    onChange={(event) =>
                                                        updateCalculatorDraft("hoursPerWeek", Number(event.target.value))
                                                    }
                                                    disabled={calculatorDraft.contractType === "FULL_TIME"}
                                                />
                                            </label>
                                            <label className="rulesField">
                                                <span>Hourly wage</span>
                                                <input
                                                    className="uiSelect"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={calculatorDraft.hourlyWage}
                                                    onChange={(event) =>
                                                        updateCalculatorDraft("hourlyWage", Number(event.target.value))
                                                    }
                                                />
                                            </label>
                                            <label className="rulesCheckbox">
                                                <input
                                                    type="checkbox"
                                                    checked={calculatorDraft.loonheffingskorting}
                                                    onChange={(event) =>
                                                        updateCalculatorDraft("loonheffingskorting", event.target.checked)
                                                    }
                                                />
                                                <span>Loonheffingskorting</span>
                                            </label>
                                            <label className="rulesCheckbox">
                                                <input
                                                    type="checkbox"
                                                    checked={calculatorDraft.pensionApplicable}
                                                    onChange={(event) =>
                                                        updateCalculatorDraft("pensionApplicable", event.target.checked)
                                                    }
                                                />
                                                <span>Pension applies</span>
                                            </label>
                                        </div>
                                        {calculatorWageWarning ? (
                                            <div className="rulesValidationError">{calculatorWageWarning}</div>
                                        ) : null}
                                        <div className="exampleNotice">
                                            Payroll tax withholding is estimated from the Belastingdienst monthly wage tax
                                            table example and scales automatically from the selected wage and
                                            loonheffingskorting choice.
                                        </div>
                                        <div className="rulesActions">
                                            <button type="button" className="button" onClick={handleGenerateCalculatorOutput}>
                                                Generate output
                                            </button>
                                        </div>
                                        <div className="tableScroll">
                                            <table className="rulesTable">
                                                <tbody>
                                                    <tr>
                                                        <th>Monthly hours</th>
                                                        <td>{numberFormatter.format(calculatorMonthlyHours)} hours</td>
                                                    </tr>
                                                    <tr>
                                                        <th>Gross wage</th>
                                                        <td>{money(calculatorResult.grossWage)}</td>
                                                    </tr>
                                                    <tr>
                                                        <th>Payroll tax withheld</th>
                                                        <td>{money(calculatorResult.payrollTaxWithheld)}</td>
                                                    </tr>
                                                    <tr>
                                                        <th>Holiday allowance reservation</th>
                                                        <td>{money(calculatorResult.holidayAllowanceReservation)}</td>
                                                    </tr>
                                                    <tr>
                                                        <th>Vacation hours buildup</th>
                                                        <td>{numberFormatter.format(calculatorResult.vacationHoursBuildUp)} hours</td>
                                                    </tr>
                                                    <tr>
                                                        <th>Employee pension deduction</th>
                                                        <td>{money(calculatorResult.employeePensionDeduction)}</td>
                                                    </tr>
                                                    <tr>
                                                        <th>Net wage paid to employee</th>
                                                        <td>{money(calculatorResult.netWagePaid)}</td>
                                                    </tr>
                                                    <tr>
                                                        <th>Employer payroll contributions</th>
                                                        <td>{money(calculatorResult.employerPayrollContributions)}</td>
                                                    </tr>
                                                    <tr>
                                                        <th>Amount payable to Belastingdienst</th>
                                                        <td>{money(calculatorResult.amountPayableToBelastingdienst)}</td>
                                                    </tr>
                                                    <tr>
                                                        <th>Amount payable to pension fund</th>
                                                        <td>{money(calculatorResult.amountPayableToPensionFund)}</td>
                                                    </tr>
                                                    <tr>
                                                        <th>Total employer cost before payroll margin</th>
                                                        <td>{money(calculatorResult.totalEmployerCostBeforePayrollMargin)}</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </Card>
                            </section>

                            <Modal
                                open={isPresetModalOpen}
                                title={presetDraft.id ? "Edit job preset" : "Create job preset"}
                                onClose={closePresetModal}
                                hideDefaultFooter
                                maxHeight={560}
                                height={560}
                            >
                                <form className="roleWizard" onSubmit={(event) => {
                                    event.preventDefault();
                                    void handleSavePreset();
                                }}>
                                    <div className="roleWizardTabs" role="tablist" aria-label="Preset setup steps">
                                        <button
                                            type="button"
                                            className={`roleWizardTab ${presetStep === "details" ? "roleWizardTab--active" : ""}`}
                                            onClick={() => setPresetStep("details")}
                                            role="tab"
                                            aria-selected={presetStep === "details"}
                                        >
                                            Details
                                        </button>
                                        <button
                                            type="button"
                                            className={`roleWizardTab ${presetStep === "rules" ? "roleWizardTab--active" : ""}`}
                                            onClick={() => setPresetStep("rules")}
                                            role="tab"
                                            aria-selected={presetStep === "rules"}
                                        >
                                            Rules
                                        </button>
                                        <button
                                            type="button"
                                            className={`roleWizardTab ${presetStep === "notes" ? "roleWizardTab--active" : ""}`}
                                            onClick={() => setPresetStep("notes")}
                                            role="tab"
                                            aria-selected={presetStep === "notes"}
                                        >
                                            Notes
                                        </button>
                                    </div>

                                    {presetStep === "details" ? (
                                        <div className="roleWizardPanel">
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Preset name</span>
                                                <input
                                                    className="modal_input"
                                                    value={presetDraft.presetName}
                                                    onChange={(event) => updatePresetDraft("presetName", event.target.value)}
                                                    placeholder="Bar employee"
                                                />
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Job title</span>
                                                <input
                                                    className="modal_input"
                                                    value={presetDraft.jobTitle}
                                                    onChange={(event) => updatePresetDraft("jobTitle", event.target.value)}
                                                    placeholder="Waiter"
                                                />
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Job function</span>
                                                <input
                                                    className="modal_input"
                                                    value={presetDraft.jobFunction}
                                                    onChange={(event) => updatePresetDraft("jobFunction", event.target.value)}
                                                    placeholder="Guest service and table care"
                                                />
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Horeca function group</span>
                                                <select
                                                    className="modal_input"
                                                    value={presetDraft.functionGroup}
                                                    onChange={(event) => updatePresetDraft("functionGroup", event.target.value)}
                                                >
                                                    <option value="I+II">I plus II</option>
                                                </select>
                                            </label>
                                        </div>
                                    ) : null}

                                    {presetStep === "rules" ? (
                                        <div className="roleWizardPanel">
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Default hourly wage</span>
                                                <input
                                                    className="modal_input"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={presetDraft.defaultHourlyWage}
                                                    onChange={(event) =>
                                                        updatePresetDraft("defaultHourlyWage", Number(event.target.value))
                                                    }
                                                />
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Default monthly wage</span>
                                                <input
                                                    className="modal_input"
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={presetDraft.defaultMonthlyWage}
                                                    onChange={(event) =>
                                                        updatePresetDraft("defaultMonthlyWage", Number(event.target.value))
                                                    }
                                                />
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Contract type</span>
                                                <select
                                                    className="modal_input"
                                                    value={presetDraft.defaultContractType}
                                                    onChange={(event) =>
                                                        updatePresetDraft("defaultContractType", event.target.value as ContractType)
                                                    }
                                                >
                                                    <option value="FULL_TIME">Full time</option>
                                                    <option value="PART_TIME">Part time</option>
                                                    <option value="ZERO_HOURS">Zero hours</option>
                                                </select>
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Default hours per week</span>
                                                <input
                                                    className="modal_input"
                                                    type="number"
                                                    min="0"
                                                    step="0.25"
                                                    value={presetDraft.defaultHoursPerWeek}
                                                    onChange={(event) =>
                                                        updatePresetDraft("defaultHoursPerWeek", Number(event.target.value))
                                                    }
                                                />
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Payroll period</span>
                                                <select
                                                    className="modal_input"
                                                    value={presetDraft.defaultPayrollPeriod}
                                                    onChange={(event) =>
                                                        updatePresetDraft("defaultPayrollPeriod", event.target.value as PayrollPeriod)
                                                    }
                                                >
                                                    <option value="MONTHLY">Monthly</option>
                                                    <option value="WEEKLY">Weekly</option>
                                                    <option value="BIWEEKLY">Bi-weekly</option>
                                                    <option value="FOUR_WEEKLY">Four-weekly</option>
                                                </select>
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Holiday allowance</span>
                                                <select
                                                    className="modal_input"
                                                    value={presetDraft.holidayAllowanceMode}
                                                    onChange={(event) =>
                                                        updatePresetDraft(
                                                            "holidayAllowanceMode",
                                                            event.target.value as HolidayAllowanceMode
                                                        )
                                                    }
                                                >
                                                    <option value="RESERVED">Reserved</option>
                                                    <option value="PAID_EACH_PERIOD">Paid each period</option>
                                                </select>
                                            </label>
                                            <div className="roleWizardCheckboxGrid">
                                                <label className="roleWizardCheckbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={presetDraft.pensionApplicable}
                                                        onChange={(event) => updatePresetDraft("pensionApplicable", event.target.checked)}
                                                    />
                                                    <span>Pension applies</span>
                                                </label>
                                                <label className="roleWizardCheckbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={presetDraft.vacationBuildUpApplicable}
                                                        onChange={(event) =>
                                                            updatePresetDraft("vacationBuildUpApplicable", event.target.checked)
                                                        }
                                                    />
                                                    <span>Vacation buildup applies</span>
                                                </label>
                                            </div>
                                        </div>
                                    ) : null}

                                    {presetStep === "notes" ? (
                                        <div className="roleWizardPanel">
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Notes</span>
                                                <textarea
                                                    className="modal_input planningWizardTextarea"
                                                    rows={4}
                                                    value={presetDraft.adminNotes}
                                                    onChange={(event) => updatePresetDraft("adminNotes", event.target.value)}
                                                    placeholder="Optional notes for the preset"
                                                />
                                            </label>
                                        </div>
                                    ) : null}

                                    {presetError ? <div className="roleWizardAlert roleWizardAlert--error">{presetError}</div> : null}
                                    <div className="roleWizardActions planningWizardActions">
                                        <button
                                            type="button"
                                            className="buttonSecondary planningWizardCancel"
                                            onClick={closePresetModal}
                                        >
                                            Cancel
                                        </button>
                                        <button type="submit" className="roleWizardPrimary">
                                            {presetDraft.id ? "Save preset" : "Create preset"}
                                        </button>
                                    </div>
                                </form>
                            </Modal>

                            {selectedSource ? (
                                <aside className="sourcePanel" aria-label="Source details">
                                    <div className="sourcePanelHeader">
                                        <h2>Source details</h2>
                                        <button
                                            type="button"
                                            className="button buttonSecondary"
                                            onClick={() => setSelectedSourceId(null)}
                                        >
                                            Close
                                        </button>
                                    </div>
                                    <div className="sourcePanelRows">
                                        <div>
                                            <span>Document name</span>
                                            <strong>{selectedSource.documentName}</strong>
                                        </div>
                                        <div>
                                            <span>Document URL</span>
                                            <a href={selectedSource.sourceUrl} target="_blank" rel="noreferrer">
                                                {selectedSource.sourceUrl}
                                            </a>
                                        </div>
                                        <div>
                                            <span>Page number</span>
                                            <strong>{selectedSource.pageNumber}</strong>
                                        </div>
                                        <div>
                                            <span>Effective date</span>
                                            <strong>
                                                {selectedSource.effectiveFrom}
                                                {selectedSource.effectiveTo ? ` to ${selectedSource.effectiveTo}` : ""}
                                            </strong>
                                        </div>
                                        <div>
                                            <span>Explanation</span>
                                            <p>{selectedSource.sourceNote}</p>
                                        </div>
                                    </div>
                                </aside>
                            ) : null}
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}
