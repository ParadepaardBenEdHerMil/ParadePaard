import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import PageToolsMenu from "../components/common/PageToolsMenu";
import {
    GetCurrentHorecaRules,
    PublishCurrentHorecaRules,
    UpdateHorecaRuleSection,
} from "../services/user-service/HorecaRules";
import {
    GetMinimumWage,
    GetWageSchedule,
    UpdateWageSchedule,
    type WageScheduleDTO,
    type WageScheduleEntryDTO,
} from "../services/user-service/GetContracts";
import type {
    HorecaRuleItemDTO,
    HorecaRuleVersionDTO,
} from "../services/user-service/Types";
import {
    HORECA_CAO_OPTIONS,
    HORECA_RULE_SOURCES,
    HORECA_WAGE_RULES,
    type PayrollRuleSource,
} from "../data/horecaPayrollRules";
import {
    formatHorecaAgeGroupLabel,
    formatSourceLabel,
} from "../utils/horecaPayrollRules";
import { formatDate } from "../utils/dateFormat";
import { formatDateInput, normalizeDateInput, parseDisplayDate } from "../utils/dateInput";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminUsers.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/Settings.css";
import "../stylesheets/HorecaPayrollRules.css";

type EditableRuleSection = "WAGE_RULES" | "TAX_AND_PAYROLL_RULES" | "PENSION_RULES" | "HOLIDAY_AND_TRAVEL_RULES";
type RuleSectionsState = Record<EditableRuleSection, HorecaRuleItemDTO[]>;

const currencyFormatter = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const ruleNumberFormatter = new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
});
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4004";
const RULE_SECTION_TITLES: Record<EditableRuleSection, string> = {
    WAGE_RULES: "Wage rules",
    TAX_AND_PAYROLL_RULES: "Tax and payroll rules",
    PENSION_RULES: "Pension rules",
    HOLIDAY_AND_TRAVEL_RULES: "Holiday and travel rules",
};

function money(value: number): string {
    return currencyFormatter.format(value);
}

function pct(value: number): string {
    return `${numberFormatter.format(value)}%`;
}

function createInitialSectionState(): RuleSectionsState {
    return {
        WAGE_RULES: buildFallbackSectionItems("WAGE_RULES"),
        TAX_AND_PAYROLL_RULES: buildFallbackSectionItems("TAX_AND_PAYROLL_RULES"),
        PENSION_RULES: buildFallbackSectionItems("PENSION_RULES"),
        HOLIDAY_AND_TRAVEL_RULES: buildFallbackSectionItems("HOLIDAY_AND_TRAVEL_RULES"),
    };
}

function sortRuleItems(items: HorecaRuleItemDTO[]): HorecaRuleItemDTO[] {
    return [...items].sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0));
}

function mergeSectionItems(section: EditableRuleSection, items?: HorecaRuleItemDTO[] | null): HorecaRuleItemDTO[] {
    const fallbackItems = sortRuleItems(buildFallbackSectionItems(section));
    const incomingItems = sortRuleItems(items ?? []);
    const incomingByKey = new Map(incomingItems.map((item) => [item.itemKey, item]));
    const merged = fallbackItems.map((fallbackItem) => ({
        ...fallbackItem,
        ...incomingByKey.get(fallbackItem.itemKey),
        sectionKey: section,
    }));
    const fallbackKeys = new Set(fallbackItems.map((item) => item.itemKey));
    const additionalItems = incomingItems
        .filter((item) => !fallbackKeys.has(item.itemKey))
        .map((item) => ({ ...item, sectionKey: section }));
    return sortRuleItems([...merged, ...additionalItems]).map((item, index) => ({
        ...item,
        sortOrder: index + 1,
    }));
}

function mapRuleSections(version?: HorecaRuleVersionDTO | null): RuleSectionsState {
    return {
        WAGE_RULES: mergeSectionItems("WAGE_RULES", version?.sections?.WAGE_RULES),
        TAX_AND_PAYROLL_RULES: mergeSectionItems("TAX_AND_PAYROLL_RULES", version?.sections?.TAX_AND_PAYROLL_RULES),
        PENSION_RULES: mergeSectionItems("PENSION_RULES", version?.sections?.PENSION_RULES),
        HOLIDAY_AND_TRAVEL_RULES: mergeSectionItems("HOLIDAY_AND_TRAVEL_RULES", version?.sections?.HOLIDAY_AND_TRAVEL_RULES),
    };
}

function toLocalDateInputValue(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function normalizeText(value?: string | null): string {
    return value?.trim() ?? "";
}

function getRuleItemNumber(item?: HorecaRuleItemDTO | null): number | null {
    if (typeof item?.valueNumber === "number" && Number.isFinite(item.valueNumber)) {
        return item.valueNumber;
    }
    return null;
}

function formatRuleDisplayValue(item: HorecaRuleItemDTO): string {
    if (item.valueType === "BOOLEAN") {
        return item.valueBoolean ? "Yes" : "No";
    }

    if (item.valueType === "NUMBER") {
        const numericValue = getRuleItemNumber(item);
        if (numericValue == null) return "-";
        const normalizedUnit = normalizeText(item.unit).toLowerCase();
        if (normalizedUnit.includes("percent")) {
            return `${ruleNumberFormatter.format(numericValue)}%`;
        }
        if (normalizedUnit === "eur") {
            return money(numericValue);
        }
        if (normalizedUnit.includes("eur per km")) {
            return `${money(numericValue)} per km`;
        }
        return item.unit ? `${ruleNumberFormatter.format(numericValue)} ${item.unit}` : ruleNumberFormatter.format(numericValue);
    }

    return item.valueText?.trim() || "-";
}

function formatRuleUsage(item: HorecaRuleItemDTO): string {
    if (item.usedInContract && item.usedInPayroll) return "Contract and payroll";
    if (item.usedInContract) return "Contract";
    if (item.usedInPayroll) return "Payroll";
    return "Reference only";
}

function formatWageMetaLabel(item: HorecaRuleItemDTO): string {
    const functionGroup = normalizeText(item.functionGroup);
    const ageGroup = normalizeText(item.ageGroup);
    if (!functionGroup && !ageGroup) return "No wage band metadata";
    if (!functionGroup) return formatHorecaAgeGroupLabel(ageGroup);
    if (!ageGroup) return `Group ${functionGroup}`;
    return `${formatHorecaAgeGroupLabel(ageGroup)} | Group ${functionGroup}`;
}

function sourceById(sourceId: string): PayrollRuleSource | null {
    return HORECA_RULE_SOURCES.find((source) => source.id === sourceId) ?? null;
}

function buildFallbackSectionItems(section: EditableRuleSection): HorecaRuleItemDTO[] {
    if (section === "HOLIDAY_AND_TRAVEL_RULES") {
        return [
            {
                itemKey: "holidayAllowancePercentage",
                name: "Holiday allowance",
                valueNumber: 8,
                valueType: "NUMBER",
                unit: "percent reserved",
                documentName: "Horeca cao 2025 2026",
                documentUrl: HORECA_RULE_SOURCES[0].sourceUrl,
                pageReference: "32",
                sourceNote: "The CAO gives employees the right to 8 percent holiday allowance.",
                usedInContract: true,
                usedInPayroll: true,
                sortOrder: 1,
            },
            {
                itemKey: "vacationBuildUpPerPaidHour",
                name: "Vacation buildup",
                valueNumber: 0.0961,
                valueType: "NUMBER",
                unit: "vacation hour per paid hour",
                documentName: "Horeca cao 2025 2026",
                documentUrl: HORECA_RULE_SOURCES[0].sourceUrl,
                pageReference: "23",
                sourceNote: "0.0769 legal vacation hour plus 0.0192 extra vacation hour per paid hour.",
                usedInContract: true,
                usedInPayroll: true,
                sortOrder: 2,
            },
            {
                itemKey: "vacationDayBuildUpPerWorkedHour",
                name: "Vacation day buildup",
                valueNumber: 0.0961,
                valueType: "NUMBER",
                unit: "vacation hour per worked hour",
                documentName: "Horeca cao 2025 2026",
                documentUrl: HORECA_RULE_SOURCES[0].sourceUrl,
                pageReference: "23",
                sourceNote: "Displayed as the vacation-hours-per-worked-hour rule used in onboarding.",
                usedInContract: true,
                usedInPayroll: true,
                sortOrder: 3,
            },
            {
                itemKey: "travelAllowancePerKilometer",
                name: "Travel allowance rate",
                valueNumber: 0.23,
                valueType: "NUMBER",
                unit: "EUR per km",
                documentName: "Horeca cao 2025 2026",
                documentUrl: HORECA_RULE_SOURCES[0].sourceUrl,
                pageReference: "32",
                sourceNote: "Temporary shared horeca rule used for onboarding and travel claim estimates.",
                usedInContract: false,
                usedInPayroll: true,
                sortOrder: 4,
            },
        ];
    }
    if (section === "PENSION_RULES") {
        return [
            { itemKey: "pensionPremiumTotal", name: "Total pension premium", valueNumber: 16.8, valueType: "NUMBER", unit: "percent", documentName: "Pensioenpremie Pensioenfonds Horeca en Catering", documentUrl: "https://www.phenc.nl/werkgever/pensioen-bij-ons/pensioenadministratie/pensioenpremie", pageReference: "Web page", sourceNote: "Total basic pension premium.", usedInContract: true, usedInPayroll: true, sortOrder: 1 },
            { itemKey: "pensionPremiumEmployee", name: "Employee part", valueNumber: 8.4, valueType: "NUMBER", unit: "percent", documentName: "Pensioenpremie Pensioenfonds Horeca en Catering", documentUrl: "https://www.phenc.nl/werkgever/pensioen-bij-ons/pensioenadministratie/pensioenpremie", pageReference: "Web page", sourceNote: "Employee part of the horeca pension premium.", usedInContract: true, usedInPayroll: true, sortOrder: 2 },
            { itemKey: "pensionPremiumEmployer", name: "Employer part", valueNumber: 8.4, valueType: "NUMBER", unit: "percent", documentName: "Pensioenpremie Pensioenfonds Horeca en Catering", documentUrl: "https://www.phenc.nl/werkgever/pensioen-bij-ons/pensioenadministratie/pensioenpremie", pageReference: "Web page", sourceNote: "Employer part of the horeca pension premium.", usedInContract: true, usedInPayroll: true, sortOrder: 3 },
        ];
    }
    if (section === "TAX_AND_PAYROLL_RULES") {
        return [
            { itemKey: "awfLowPercentage", name: "AWf low", valueNumber: 2.74, valueType: "NUMBER", unit: "percent", documentName: "Tarieven, bedragen en percentages loonheffingen vanaf 1 januari 2026", documentUrl: "https://download.belastingdienst.nl/belastingdienst/docs/bijlage-nieuwsbrief-loonheffingen-2026-lh2091b63fd.pdf", pageReference: "10", sourceNote: "Low AWf premium percentage.", usedInContract: false, usedInPayroll: true, sortOrder: 1 },
            { itemKey: "zvwEmployeePercentage", name: "Employee Zvw contribution", valueNumber: 4.85, valueType: "NUMBER", unit: "percent", documentName: "Tarieven, bedragen en percentages loonheffingen vanaf 1 januari 2026", documentUrl: "https://download.belastingdienst.nl/belastingdienst/docs/bijlage-nieuwsbrief-loonheffingen-2026-lh2091b63fd.pdf", pageReference: "13", sourceNote: "Inhouding bijdrage Zvw, withheld only in special cases (capped at the maximumbijdrageloon).", usedInContract: true, usedInPayroll: true, sortOrder: 2 },
            { itemKey: "loonheffingTableSource", name: "Loonheffing wage-tax table", valueText: "Belastingdienst tijdvaktabellen 2026 (statutory)", valueType: "TEXT", unit: "", documentName: "Handboek Loonheffingen 2026", documentUrl: "https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf", pageReference: "Bijlage 1", sourceNote: "Loonbelasting/premie volksverzekeringen are computed automatically from the national brackets and heffingskortingen; identical for every employer.", usedInContract: false, usedInPayroll: true, sortOrder: 3 },
            { itemKey: "monthlyPayrollTaxWithCreditExample", name: "Payroll tax with loonheffingskorting", valueNumber: 160.5, valueType: "NUMBER", unit: "EUR", documentName: "Witte Maandloon tabel loonbelasting premie volksverzekeringen Nederland Standaard 2026", documentUrl: "https://download.belastingdienst.nl/belastingdienst/dl/rekenhulpen/loonheffing/2026/v01/pdf/wit_mnd_nl_std_20260101.pdf", pageReference: "15", sourceNote: "Example monthly withholding with loonheffingskorting.", usedInContract: false, usedInPayroll: true, sortOrder: 4 },
        ];
    }
    return [
        ...HORECA_WAGE_RULES
            .filter((rule) => rule.functionGroup === "I+II")
            .sort((left, right) => {
                const leftAge = left.ageGroup === "Adult" ? 999 : Number(left.ageGroup);
                const rightAge = right.ageGroup === "Adult" ? 999 : Number(right.ageGroup);
                return rightAge - leftAge;
            })
            .map((rule, index) => ({
                itemKey:
                    rule.ageGroup === "Adult"
                        ? "adultFunctionGroupI_IIHourlyWage"
                        : `age${rule.ageGroup}FunctionGroupI_IIHourlyWage`,
                name: `${rule.ageGroup === "Adult" ? "Adult" : `Age ${rule.ageGroup}`} function group ${rule.functionGroup} hourly wage`,
                valueNumber: rule.hourlyWage,
                valueType: "NUMBER" as const,
                unit: "EUR",
                documentName: "Loontabel per 1 januari 2026",
                documentUrl: "https://static2.khn.nl/public/images/downloads/Loontabel-per-1-januari-20261.pdf",
                pageReference: "1",
                functionGroup: rule.functionGroup,
                ageGroup: rule.ageGroup,
                sourceNote:
                    rule.ageGroup === "Adult"
                        ? `Adult horeca hourly wage for function group ${rule.functionGroup}.`
                        : `Horeca hourly wage for age group ${rule.ageGroup} in function group ${rule.functionGroup}.`,
                usedInContract: true,
                usedInPayroll: true,
                sortOrder: index + 1,
            })),
    ];
}

// The wage rules are sourced from contract-service's date-aware schedule (the single source
// of truth it enforces), not the user-service rule version. minimumAge 21 is the adult (21+)
// band; younger bands map to their exact age.
const WAGE_STATUTORY_DOCUMENT_NAME = "Dutch statutory minimum wage (WML)";

function ageGroupFromMinimumAge(minimumAge: number): string {
    return minimumAge >= 21 ? "Adult" : String(minimumAge);
}

function minimumAgeFromAgeGroup(ageGroup?: string | null): number | null {
    const normalized = normalizeText(ageGroup);
    if (!normalized) return null;
    if (normalized.toLowerCase() === "adult") return 21;
    const parsed = Number(normalized);
    return Number.isInteger(parsed) ? parsed : null;
}

function latestWageEntry(schedule?: WageScheduleDTO | null): WageScheduleEntryDTO | null {
    // The API returns entries newest effective date first.
    return schedule?.entries?.[0] ?? null;
}

function buildWageItemsFromScheduleEntry(entry?: WageScheduleEntryDTO | null): HorecaRuleItemDTO[] {
    if (!entry) return [];
    return [...entry.rates]
        .sort((left, right) => right.minimumAge - left.minimumAge)
        .map((rate, index) => {
            const ageGroup = ageGroupFromMinimumAge(rate.minimumAge);
            return {
                itemKey:
                    ageGroup === "Adult"
                        ? "adultFunctionGroupI_IIHourlyWage"
                        : `age${ageGroup}FunctionGroupI_IIHourlyWage`,
                name: `${ageGroup === "Adult" ? "Adult" : `Age ${ageGroup}`} minimum hourly wage`,
                valueNumber: rate.hourlyRate,
                valueType: "NUMBER",
                unit: "EUR",
                documentName: entry.documentName ?? WAGE_STATUTORY_DOCUMENT_NAME,
                documentUrl: entry.documentUrl ?? undefined,
                functionGroup: "I+II",
                ageGroup,
                sourceNote: `Statutory minimum wage enforced by contract-service, effective ${formatDate(entry.effectiveFrom)}.`,
                usedInContract: true,
                usedInPayroll: true,
                sortOrder: index + 1,
            } as HorecaRuleItemDTO;
        });
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

export default function HorecaPayrollRules() {
    const [ruleSections, setRuleSections] = useState<RuleSectionsState>(createInitialSectionState);
    const [ruleVersion, setRuleVersion] = useState<HorecaRuleVersionDTO | null>(null);
    const [rulesLoadError, setRulesLoadError] = useState<string | null>(null);
    const [rulesStatusMessage, setRulesStatusMessage] = useState<string | null>(null);
    const [isRulePublishPending, setIsRulePublishPending] = useState(false);
    const [isRulesLoading, setIsRulesLoading] = useState(true);
    const [activeRuleSection, setActiveRuleSection] = useState<EditableRuleSection | null>(null);
    const [ruleEditorDraftItems, setRuleEditorDraftItems] = useState<HorecaRuleItemDTO[]>([]);
    const [ruleEditorError, setRuleEditorError] = useState<string | null>(null);
    const [expandedRuleEditorItemKey, setExpandedRuleEditorItemKey] = useState<string | null>(null);
    // Authoritative, date-aware statutory minimum enforced by contract-service (single source
    // of truth). Shown so admins can see the enforced adult floor, not just the editable rows.
    const [enforcedAdultMinimum, setEnforcedAdultMinimum] = useState<{ wage: number | null; effectiveFrom: string | null } | null>(null);
    // The wage table is sourced from and saved to contract-service's editable schedule — the
    // same one it enforces — so edits here update the backend on one line.
    const [wageSchedule, setWageSchedule] = useState<WageScheduleDTO | null>(null);
    const [wageEffectiveFrom, setWageEffectiveFrom] = useState<string>(formatDateInput(toLocalDateInputValue()));
    // The source document applies to the whole dated table, so it lives in the editor header
    // (not per row). Persisted with the schedule and shown as the loontabel's source link.
    const [wageDocumentName, setWageDocumentName] = useState<string>("");
    const [wageDocumentUrl, setWageDocumentUrl] = useState<string>("");

    const holidaySectionItems = ruleSections.HOLIDAY_AND_TRAVEL_RULES;
    const pensionSectionItems = ruleSections.PENSION_RULES;
    const currentWageEntry = latestWageEntry(wageSchedule);
    const scheduleWageItems = buildWageItemsFromScheduleEntry(currentWageEntry);
    // Prefer the contract-service schedule; fall back to the user-service rows only when the
    // schedule endpoint is unreachable, so the table still renders if the backend is down.
    const wageSectionItems = scheduleWageItems.length > 0 ? scheduleWageItems : ruleSections.WAGE_RULES;
    const holidayAllowanceItem = holidaySectionItems.find((item) => item.itemKey === "holidayAllowancePercentage");
    const pensionEmployeeItem = pensionSectionItems.find((item) => item.itemKey === "pensionPremiumEmployee");
    const pensionEmployerItem = pensionSectionItems.find((item) => item.itemKey === "pensionPremiumEmployer");
    const wageReferenceItem = wageSectionItems.find((item) => item.ageGroup === "Adult" && item.functionGroup === "I+II")
        ?? wageSectionItems[0]
        ?? buildFallbackSectionItems("WAGE_RULES")[0];
    const wageRuleCount = wageSectionItems.filter((item) => getRuleItemNumber(item) != null).length;
    const holidayAllowancePct = getRuleItemNumber(holidayAllowanceItem) ?? 8;
    const fullTimeWeeklyHours = 38;
    const fullTimeMonthlyHours = 164.67;
    const pensionEmployeePct = getRuleItemNumber(pensionEmployeeItem) ?? 8.4;
    const pensionEmployerPct = getRuleItemNumber(pensionEmployerItem) ?? 8.4;

    // Wage rows come from the contract-service schedule; the other sections stay on the
    // user-service rule version.
    const sectionItemsFor = (section: EditableRuleSection): HorecaRuleItemDTO[] =>
        section === "WAGE_RULES" ? wageSectionItems : ruleSections[section];

    const applyRuleVersion = (version: HorecaRuleVersionDTO) => {
        setRuleVersion(version);
        setRuleSections(mapRuleSections(version));
    };

    useEffect(() => {
        let isCancelled = false;

        const loadRules = async () => {
            setIsRulesLoading(true);
            setRulesLoadError(null);
            try {
                const currentRules = await GetCurrentHorecaRules(API_BASE_URL);
                if (isCancelled) return;
                applyRuleVersion(currentRules);
            } catch (error) {
                if (isCancelled) return;
                console.error("Failed to load horeca rules", error);
                setRulesLoadError("Could not load the backend horeca rules. Showing the current fallback values instead.");
            } finally {
                if (!isCancelled) {
                    setIsRulesLoading(false);
                }
            }
        };

        void loadRules();

        return () => {
            isCancelled = true;
        };
    }, []);

    useEffect(() => {
        let isCancelled = false;
        const today = toLocalDateInputValue();
        const now = new Date();
        const adultDateOfBirth = toLocalDateInputValue(new Date(now.getFullYear() - 30, now.getMonth(), now.getDate()));
        GetMinimumWage(API_BASE_URL, today, adultDateOfBirth)
            .then((res) => {
                if (!isCancelled) setEnforcedAdultMinimum({ wage: res.minimumHourlyWage, effectiveFrom: res.effectiveFrom });
            })
            .catch(() => {
                if (!isCancelled) setEnforcedAdultMinimum(null);
            });
        return () => {
            isCancelled = true;
        };
    }, []);

    useEffect(() => {
        let isCancelled = false;
        GetWageSchedule(API_BASE_URL)
            .then((schedule) => {
                if (isCancelled) return;
                setWageSchedule(schedule);
                const latest = latestWageEntry(schedule);
                // Default the editor's date to the current table, so a plain edit corrects it
                // in place; the admin changes the date to publish a new loontabel.
                if (latest) {
                    setWageEffectiveFrom(formatDateInput(latest.effectiveFrom));
                    setWageDocumentName(latest.documentName ?? "");
                    setWageDocumentUrl(latest.documentUrl ?? "");
                }
            })
            .catch((error) => {
                console.error("Failed to load the contract-service wage schedule", error);
            });
        return () => {
            isCancelled = true;
        };
    }, []);

    const sourceButton = (sourceId: string, pageNumber?: string) => (
        <a
            className="sourcePill"
            href={sourceById(sourceId)?.sourceUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
        >
            {formatSourceLabel(sourceId, pageNumber)}
        </a>
    );

    const publishRuleDraft = async (reason: string): Promise<HorecaRuleVersionDTO> => {
        return await PublishCurrentHorecaRules(API_BASE_URL, {
            effectiveFrom: toLocalDateInputValue(),
            versionLabel: `Horeca rules ${toLocalDateInputValue()}`,
            reason,
        });
    };

    const openRuleEditor = (section: EditableRuleSection) => {
        const nextItems = sectionItemsFor(section).map((item) => ({ ...item }));
        setActiveRuleSection(section);
        setRuleEditorDraftItems(nextItems);
        setRuleEditorError(null);
        setExpandedRuleEditorItemKey(nextItems[0]?.itemKey ?? null);
        if (section === "WAGE_RULES") {
            setWageEffectiveFrom(formatDateInput(currentWageEntry?.effectiveFrom ?? toLocalDateInputValue()));
            setWageDocumentName(currentWageEntry?.documentName ?? "");
            setWageDocumentUrl(currentWageEntry?.documentUrl ?? "");
        }
    };

    const closeRuleEditor = () => {
        setActiveRuleSection(null);
        setRuleEditorDraftItems([]);
        setRuleEditorError(null);
        setExpandedRuleEditorItemKey(null);
    };

    const toggleRuleEditorItem = (itemKey: string) => {
        setExpandedRuleEditorItemKey((prev) => (prev === itemKey ? null : itemKey));
    };

    const updateRuleEditorItem = <K extends keyof HorecaRuleItemDTO>(
        index: number,
        key: K,
        value: HorecaRuleItemDTO[K]
    ) => {
        setRuleEditorDraftItems((prev) =>
            prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item))
        );
    };

    // Wage rows save straight to contract-service's date-aware schedule (the enforced source
    // of truth), not the user-service rule version. Only the age band and hourly wage are
    // persisted; the schedule is the statutory floor, so the other metadata is presentational.
    const handleSaveWageSchedule = async () => {
        const rates: { minimumAge: number; hourlyRate: number }[] = [];
        const seenAges = new Set<number>();
        for (const item of ruleEditorDraftItems) {
            const minimumAge = minimumAgeFromAgeGroup(item.ageGroup);
            const hourlyRate = getRuleItemNumber(item);
            if (minimumAge == null) {
                setRuleEditorError(`Age group is required for ${item.name}.`);
                return;
            }
            if (seenAges.has(minimumAge)) {
                setRuleEditorError(`Two rows share the ${formatHorecaAgeGroupLabel(item.ageGroup)} age band. Each age band needs one row.`);
                return;
            }
            if (hourlyRate == null || hourlyRate < 0) {
                setRuleEditorError(`A valid hourly wage is required for ${item.name}.`);
                return;
            }
            seenAges.add(minimumAge);
            rates.push({ minimumAge, hourlyRate });
        }
        if (rates.length === 0) {
            setRuleEditorError("At least one wage row is required.");
            return;
        }
        const effectiveIso = parseDisplayDate(wageEffectiveFrom);
        if (!effectiveIso) {
            setRuleEditorError("Enter the effective date as dd/mm/yyyy.");
            return;
        }

        setIsRulePublishPending(true);
        setRuleEditorError(null);
        setRulesStatusMessage(null);
        try {
            const updated = await UpdateWageSchedule(API_BASE_URL, {
                effectiveFrom: effectiveIso,
                documentName: wageDocumentName.trim() || null,
                documentUrl: wageDocumentUrl.trim() || null,
                rates,
            });
            setWageSchedule(updated);
            const latest = latestWageEntry(updated);
            if (latest) {
                setWageEffectiveFrom(formatDateInput(latest.effectiveFrom));
                setWageDocumentName(latest.documentName ?? "");
                setWageDocumentUrl(latest.documentUrl ?? "");
            }
            setRulesStatusMessage(
                `Wage table effective ${wageEffectiveFrom} saved to contract-service and enforced for new contracts.`
            );
            closeRuleEditor();
        } catch (error) {
            console.error("Failed to save wage schedule", error);
            setRuleEditorError(error instanceof Error ? error.message : "Could not save the wage table to the backend.");
        } finally {
            setIsRulePublishPending(false);
        }
    };

    const handleSaveRuleSection = async () => {
        if (!activeRuleSection) {
            return;
        }

        if (activeRuleSection === "WAGE_RULES") {
            await handleSaveWageSchedule();
            return;
        }

        setIsRulePublishPending(true);
        setRuleEditorError(null);
        setRulesStatusMessage(null);

        try {
            await UpdateHorecaRuleSection(API_BASE_URL, activeRuleSection, {
                items: ruleEditorDraftItems.map((item, index) => ({
                    ...item,
                    id: item.id ?? undefined,
                    sectionKey: activeRuleSection,
                    sortOrder: index + 1,
                })),
            });
            const publishedVersion = await publishRuleDraft(`Updated ${RULE_SECTION_TITLES[activeRuleSection].toLowerCase()}.`);
            applyRuleVersion(publishedVersion);
            setRulesStatusMessage(`${RULE_SECTION_TITLES[activeRuleSection]} saved to the backend and published for new contracts.`);
            closeRuleEditor();
        } catch (error) {
            console.error("Failed to save horeca rule section", error);
            setRuleEditorError("Could not save this section to the backend.");
        } finally {
            setIsRulePublishPending(false);
        }
    };

    const renderRuleSectionTable = (section: EditableRuleSection) => (
        <div className="tableScroll">
            <table className="rulesTable">
                <thead>
                    {section === "WAGE_RULES" ? (
                        <tr>
                            <th>Age group</th>
                            <th>Function group</th>
                            <th>Hourly wage</th>
                            <th>Used for</th>
                            <th>Document</th>
                        </tr>
                    ) : (
                        <tr>
                            <th>Name</th>
                            <th>Value</th>
                            <th>Used for</th>
                            <th>Document</th>
                            <th>Page</th>
                        </tr>
                    )}
                </thead>
                <tbody>
                    {sectionItemsFor(section).map((item) => (
                        section === "WAGE_RULES" ? (
                            <tr key={item.id ?? item.itemKey}>
                                <td>
                                    <strong>{formatHorecaAgeGroupLabel(item.ageGroup)}</strong>
                                    <span>{item.name}</span>
                                </td>
                                <td data-label="Function group">{item.functionGroup ?? "-"}</td>
                                <td data-label="Hourly wage">
                                    <strong>{formatRuleDisplayValue(item)}</strong>
                                    {item.sourceNote ? <span>{item.sourceNote}</span> : null}
                                </td>
                                <td data-label="Used for">{formatRuleUsage(item)}</td>
                                <td data-label="Document">
                                    {item.documentUrl ? (
                                        <a href={item.documentUrl} target="_blank" rel="noreferrer">
                                            {item.documentName}
                                        </a>
                                    ) : (
                                        <strong>{item.documentName ?? "-"}</strong>
                                    )}
                                </td>
                            </tr>
                        ) : (
                            <tr key={item.id ?? item.itemKey}>
                                <td>
                                    <strong>{item.name}</strong>
                                    {item.calculationRule ? <span>{item.calculationRule}</span> : null}
                                </td>
                                <td data-label="Value">
                                    <strong>{formatRuleDisplayValue(item)}</strong>
                                    {item.sourceNote ? <span>{item.sourceNote}</span> : null}
                                </td>
                                <td data-label="Used for">{formatRuleUsage(item)}</td>
                                <td data-label="Document">
                                    {item.documentUrl ? (
                                        <a href={item.documentUrl} target="_blank" rel="noreferrer">
                                            {item.documentName}
                                        </a>
                                    ) : (
                                        <strong>{item.documentName ?? "-"}</strong>
                                    )}
                                </td>
                                <td data-label="Page">{item.pageReference ?? "-"}</td>
                            </tr>
                        )
                    ))}
                </tbody>
            </table>
        </div>
    );

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
                                <h1 className="pageTitle">Payroll and Contract Rules</h1>
                                <p className="pageSubtitle">
                                    Manage source-backed horeca contract values before employment contracts are generated.
                                </p>
                            </div>
                            <PageToolsMenu
                                exportAction={{
                                    filename: "horeca-wage-schedule",
                                    build: () => {
                                        const rows: string[][] = [["Effective from", "Minimum age", "Hourly rate (EUR)"]];
                                        for (const entry of wageSchedule?.entries ?? []) {
                                            for (const rate of [...entry.rates].sort((a, b) => b.minimumAge - a.minimumAge)) {
                                                rows.push([
                                                    formatDate(entry.effectiveFrom),
                                                    String(rate.minimumAge),
                                                    rate.hourlyRate.toFixed(2),
                                                ]);
                                            }
                                        }
                                        return rows;
                                    },
                                }}
                                disabled={!wageSchedule}
                            />
                        </header>

                        {rulesLoadError ? <div className="rulesError">{rulesLoadError}</div> : null}
                        {rulesStatusMessage ? <div className="rulesValidationWarning">{rulesStatusMessage}</div> : null}

                        <div className="horecaRulesLayout">
                            <section className="horecaRulesMain">
                                <Card title="Example contract population" className="horecaRulesCard">
                                    <div className="horecaCardBody">
                                        <div className="sectionIntro">
                                            Keep these horeca defaults aligned before new hires move through onboarding.
                                            The values below flow into contract drafting and future payroll calculations.
                                        </div>
                                        <div className="ruleValueGrid">
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Horeca CAO</span>
                                                <strong>{HORECA_CAO_OPTIONS[0].name}</strong>
                                                <span className="ruleValueNote">
                                                    {fullTimeWeeklyHours} hours per week, {fullTimeMonthlyHours} hours per month
                                                    at full time.
                                                </span>
                                                {sourceButton("horeca-cao-2025-2026", "12")}
                                            </div>
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Age-based wage rows</span>
                                                <strong>{wageRuleCount} managed wage rows</strong>
                                                <span className="ruleValueNote">
                                                    {enforcedAdultMinimum?.wage != null
                                                        ? `Enforced adult minimum ${money(enforcedAdultMinimum.wage)}${
                                                              enforcedAdultMinimum.effectiveFrom
                                                                  ? ` (statutory, effective ${formatDate(enforcedAdultMinimum.effectiveFrom)})`
                                                                  : ""
                                                          }.`
                                                        : `Adult group I+II currently ${formatRuleDisplayValue(wageReferenceItem)}.`}
                                                    {" "}Contract drafting matches by function group and employee age group.
                                                </span>
                                                {enforcedAdultMinimum?.wage != null
                                                    ? null
                                                    : sourceButton("loontabel-2026-01-01", "1")}
                                            </div>
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Holiday allowance</span>
                                                <strong>{pct(holidayAllowancePct)}</strong>
                                                <span className="ruleValueNote">
                                                    Reserved or paid each period depending on the contract setup.
                                                </span>
                                                {sourceButton("horeca-cao-2025-2026", "32")}
                                            </div>
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Pension split</span>
                                                <strong>{pct(pensionEmployeePct + pensionEmployerPct)} total</strong>
                                                <span className="ruleValueNote">
                                                    {pct(pensionEmployeePct)} employee and {pct(pensionEmployerPct)} employer.
                                                </span>
                                                {sourceButton("phenc-pensioenpremie")}
                                            </div>
                                            <div className="ruleValueCard">
                                                <span className="ruleValueLabel">Rule version</span>
                                                <strong>{ruleVersion?.versionLabel ?? "Fallback values"}</strong>
                                                <span className="ruleValueNote">
                                                    {isRulesLoading
                                                        ? "Loading backend version..."
                                                        : `Status: ${ruleVersion?.status ?? "fallback"}${
                                                              ruleVersion?.effectiveFrom ? ` from ${formatDate(ruleVersion.effectiveFrom)}` : ""
                                                          }`}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="businessFlowText">
                                            The horeca client provides the work environment, while the payroll company keeps
                                            the contract defaults, legal source values, and payroll rule versioning aligned
                                            before new contracts are generated.
                                        </p>
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
                                                    <li>CAO, job title, job function, function group, and age-group wage row</li>
                                                    <li>Contract type, start date, end date, wage, hours, and payroll period</li>
                                                    <li>Pension, holiday allowance, vacation buildup, and billing settings</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </Card>

                                <Card
                                    title="Wage rules"
                                    className="horecaRulesCard"
                                    right={
                                        <button
                                            type="button"
                                            className="tableActionIconButton"
                                            aria-label="Edit wage rules"
                                            title="Edit wage rules"
                                            onClick={() => openRuleEditor("WAGE_RULES")}
                                        >
                                            <PencilIcon />
                                        </button>
                                    }
                                >
                                    <div className="horecaCardBody">
                                        <div className="sectionIntro">
                                            These rows are the statutory minimum wage that contract-service enforces on
                                            contract creation{currentWageEntry ? `, effective ${formatDate(currentWageEntry.effectiveFrom)}` : ""}.
                                            Editing saves a dated table straight to that backend, so the enforced minimum
                                            stays on one line with this page.
                                        </div>
                                        {renderRuleSectionTable("WAGE_RULES")}
                                    </div>
                                </Card>

                                <Card
                                    title="Tax and payroll rules"
                                    className="horecaRulesCard"
                                    right={
                                        <button
                                            type="button"
                                            className="tableActionIconButton"
                                            aria-label="Edit tax and payroll rules"
                                            title="Edit tax and payroll rules"
                                            onClick={() => openRuleEditor("TAX_AND_PAYROLL_RULES")}
                                        >
                                            <PencilIcon />
                                        </button>
                                    }
                                >
                                    <div className="horecaCardBody">
                                        <div className="sectionIntro">
                                            Tax and payroll values are versioned backend records so future payroll periods
                                            resolve the correct lawful source by effective date.
                                        </div>
                                        {renderRuleSectionTable("TAX_AND_PAYROLL_RULES")}
                                    </div>
                                </Card>

                                <Card
                                    title="Pension rules"
                                    className="horecaRulesCard"
                                    right={
                                        <button
                                            type="button"
                                            className="tableActionIconButton"
                                            aria-label="Edit pension rules"
                                            title="Edit pension rules"
                                            onClick={() => openRuleEditor("PENSION_RULES")}
                                        >
                                            <PencilIcon />
                                        </button>
                                    }
                                >
                                    <div className="horecaCardBody">
                                        <div className="sectionIntro">
                                            Pension values and wording can be updated with the exact source document and
                                            page, while older contract versions stay in history unchanged.
                                        </div>
                                        {renderRuleSectionTable("PENSION_RULES")}
                                    </div>
                                </Card>

                                <Card
                                    title="Holiday and travel rules"
                                    className="horecaRulesCard"
                                    right={
                                        <button
                                            type="button"
                                            className="tableActionIconButton"
                                            aria-label="Edit holiday and travel rules"
                                            title="Edit holiday and travel rules"
                                            onClick={() => openRuleEditor("HOLIDAY_AND_TRAVEL_RULES")}
                                        >
                                            <PencilIcon />
                                        </button>
                                    }
                                >
                                    <div className="horecaCardBody">
                                        <div className="sectionIntro">
                                            Holiday allowance, vacation buildup, vacation day buildup, and travel allowance
                                            all publish as editable backend rule items with document and page references.
                                        </div>
                                        {renderRuleSectionTable("HOLIDAY_AND_TRAVEL_RULES")}
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
                                                    <th>Link</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {HORECA_RULE_SOURCES.map((source) => (
                                                    <tr key={source.id}>
                                                        <td>
                                                            <strong>{source.documentName}</strong>
                                                            <span>{source.sourceName}</span>
                                                        </td>
                                                        <td data-label="Used for">{source.sourceNote}</td>
                                                        <td data-label="Effective">
                                                            {source.effectiveFrom}
                                                            {source.effectiveTo ? ` to ${source.effectiveTo}` : ""}
                                                        </td>
                                                        <td data-label="Page">{source.pageNumber}</td>
                                                        <td data-label="Link">
                                                            <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                                                                Open document
                                                            </a>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </section>

                            <Modal
                                open={activeRuleSection !== null}
                                title={activeRuleSection ? RULE_SECTION_TITLES[activeRuleSection] : "Edit rules"}
                                onClose={closeRuleEditor}
                                hideDefaultFooter
                                maxHeight={680}
                                height={680}
                            >
                                {activeRuleSection ? (
                                    <form
                                        className="ruleEditorForm"
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            void handleSaveRuleSection();
                                        }}
                                    >
                                        <div className="sectionIntro">
                                            {activeRuleSection === "WAGE_RULES"
                                                ? "Edit the minimum hourly wage per age band. Saving writes a dated table to contract-service and enforces it immediately — only the age band and hourly wage are saved."
                                                : "Edit the backend rule items for this section. Saving publishes a new effective version for future contracts and payroll calculations."}
                                        </div>
                                        {activeRuleSection === "WAGE_RULES" ? (
                                            <>
                                                <label className="rulesField rulesFieldFull wageEditorHeaderField">
                                                    <span>Effective from</span>
                                                    <input
                                                        className="modal_input"
                                                        inputMode="numeric"
                                                        placeholder="dd/mm/yyyy"
                                                        value={wageEffectiveFrom}
                                                        onChange={(event) => setWageEffectiveFrom(normalizeDateInput(event.target.value))}
                                                    />
                                                    <span className="ruleValueNote">
                                                        Keep the current date to correct this table; pick a new date to publish a
                                                        new loontabel (for example when the statutory minimum changes).
                                                    </span>
                                                </label>
                                                <label className="rulesField rulesFieldFull wageEditorHeaderField">
                                                    <span>Document name</span>
                                                    <input
                                                        className="modal_input"
                                                        value={wageDocumentName}
                                                        onChange={(event) => setWageDocumentName(event.target.value)}
                                                        placeholder="e.g. Dutch statutory minimum wage (WML)"
                                                    />
                                                </label>
                                                <label className="rulesField rulesFieldFull wageEditorHeaderField">
                                                    <span>Document URL</span>
                                                    <input
                                                        className="modal_input"
                                                        value={wageDocumentUrl}
                                                        onChange={(event) => setWageDocumentUrl(event.target.value)}
                                                        placeholder="https://…"
                                                    />
                                                    <span className="ruleValueNote">
                                                        The source for this whole table; shown as the loontabel's source link on
                                                        this page.
                                                    </span>
                                                </label>
                                            </>
                                        ) : null}
                                        <div className="ruleEditorList">
                                            {ruleEditorDraftItems.map((item, index) => {
                                                const isExpanded = expandedRuleEditorItemKey === item.itemKey;
                                                const itemPanelId = `rule-editor-panel-${item.itemKey}`;
                                                return (
                                                    <section
                                                        className={`ruleEditorItem${isExpanded ? " ruleEditorItem--expanded" : ""}`}
                                                        key={item.id ?? item.itemKey}
                                                    >
                                                        <button
                                                            type="button"
                                                            className="ruleEditorItemToggle"
                                                            aria-expanded={isExpanded}
                                                            aria-controls={itemPanelId}
                                                            onClick={() => toggleRuleEditorItem(item.itemKey)}
                                                        >
                                                            <div className="ruleEditorItemHeader">
                                                                <div className="ruleEditorItemIdentity">
                                                                    <h3>{item.name}</h3>
                                                                    <span>{item.itemKey}</span>
                                                                    {activeRuleSection === "WAGE_RULES" ? (
                                                                        <span className="ruleEditorItemMeta">{formatWageMetaLabel(item)}</span>
                                                                    ) : null}
                                                                </div>
                                                                <div className="ruleEditorItemSummary">
                                                                    <strong>{formatRuleDisplayValue(item)}</strong>
                                                                    <span>{formatRuleUsage(item)}</span>
                                                                </div>
                                                                <span
                                                                    className={`ruleEditorItemChevron${
                                                                        isExpanded ? " ruleEditorItemChevron--expanded" : ""
                                                                    }`}
                                                                    aria-hidden="true"
                                                                >
                                                                    ▾
                                                                </span>
                                                            </div>
                                                        </button>
                                                        {isExpanded ? (
                                                            <div className="ruleEditorItemPanel" id={itemPanelId}>
                                                                <div className="rulesFormGrid">
                                                                    <label className="rulesField">
                                                                        <span>Name</span>
                                                                        <input
                                                                            className="modal_input"
                                                                            value={item.name}
                                                                            onChange={(event) =>
                                                                                updateRuleEditorItem(index, "name", event.target.value)
                                                                            }
                                                                        />
                                                                    </label>
                                                                    <label className="rulesField">
                                                                        <span>Value type</span>
                                                                        <select
                                                                            className="modal_input"
                                                                            value={item.valueType ?? "TEXT"}
                                                                            onChange={(event) =>
                                                                                updateRuleEditorItem(index, "valueType", event.target.value)
                                                                            }
                                                                        >
                                                                            <option value="TEXT">Text</option>
                                                                            <option value="NUMBER">Number</option>
                                                                            <option value="BOOLEAN">Boolean</option>
                                                                        </select>
                                                                    </label>
                                                                    <label className="rulesField">
                                                                        <span>Value</span>
                                                                        {item.valueType === "BOOLEAN" ? (
                                                                            <select
                                                                                className="modal_input"
                                                                                value={item.valueBoolean ? "true" : "false"}
                                                                                onChange={(event) =>
                                                                                    updateRuleEditorItem(
                                                                                        index,
                                                                                        "valueBoolean",
                                                                                        event.target.value === "true"
                                                                                    )
                                                                                }
                                                                            >
                                                                                <option value="true">True</option>
                                                                                <option value="false">False</option>
                                                                            </select>
                                                                        ) : item.valueType === "NUMBER" ? (
                                                                            <input
                                                                                className="modal_input"
                                                                                type="number"
                                                                                step={normalizeText(item.unit).toLowerCase().includes("hour") ? "0.0001" : "0.01"}
                                                                                value={item.valueNumber ?? 0}
                                                                                onChange={(event) =>
                                                                                    updateRuleEditorItem(
                                                                                        index,
                                                                                        "valueNumber",
                                                                                        Number(event.target.value)
                                                                                    )
                                                                                }
                                                                            />
                                                                        ) : (
                                                                            <input
                                                                                className="modal_input"
                                                                                value={item.valueText ?? ""}
                                                                                onChange={(event) =>
                                                                                    updateRuleEditorItem(index, "valueText", event.target.value)
                                                                                }
                                                                            />
                                                                        )}
                                                                    </label>
                                                                    <label className="rulesField">
                                                                        <span>Unit</span>
                                                                        <input
                                                                            className="modal_input"
                                                                            value={item.unit ?? ""}
                                                                            onChange={(event) =>
                                                                                updateRuleEditorItem(index, "unit", event.target.value)
                                                                            }
                                                                        />
                                                                    </label>
                                                                    {activeRuleSection === "WAGE_RULES" ? (
                                                                        <>
                                                                            <label className="rulesField">
                                                                                <span>Function group</span>
                                                                                <select
                                                                                    className="modal_input"
                                                                                    value={item.functionGroup ?? ""}
                                                                                    onChange={(event) =>
                                                                                        updateRuleEditorItem(index, "functionGroup", event.target.value)
                                                                                    }
                                                                                >
                                                                                    <option value="">Select function group</option>
                                                                                    <option value="I+II">I plus II</option>
                                                                                    <option value="III">III</option>
                                                                                    <option value="IV">IV</option>
                                                                                    <option value="V">V</option>
                                                                                </select>
                                                                            </label>
                                                                            <label className="rulesField">
                                                                                <span>Age group</span>
                                                                                <select
                                                                                    className="modal_input"
                                                                                    value={item.ageGroup ?? ""}
                                                                                    onChange={(event) =>
                                                                                        updateRuleEditorItem(index, "ageGroup", event.target.value)
                                                                                    }
                                                                                >
                                                                                    <option value="">Select age group</option>
                                                                                    <option value="Adult">Adult (21+)</option>
                                                                                    <option value="20">20 years</option>
                                                                                    <option value="19">19 years</option>
                                                                                    <option value="18">18 years</option>
                                                                                    <option value="17">17 years</option>
                                                                                    <option value="16">16 years</option>
                                                                                    <option value="15">15 years</option>
                                                                                </select>
                                                                            </label>
                                                                        </>
                                                                    ) : null}
                                                                    {activeRuleSection !== "WAGE_RULES" ? (
                                                                        <label className="rulesField rulesFieldFull">
                                                                            <span>Calculation rule</span>
                                                                            <input
                                                                                className="modal_input"
                                                                                value={item.calculationRule ?? ""}
                                                                                onChange={(event) =>
                                                                                    updateRuleEditorItem(index, "calculationRule", event.target.value)
                                                                                }
                                                                            />
                                                                        </label>
                                                                    ) : null}
                                                                    {activeRuleSection !== "WAGE_RULES" ? (
                                                                        <>
                                                                            <label className="rulesField">
                                                                                <span>Document</span>
                                                                                <input
                                                                                    className="modal_input"
                                                                                    value={item.documentName ?? ""}
                                                                                    onChange={(event) =>
                                                                                        updateRuleEditorItem(index, "documentName", event.target.value)
                                                                                    }
                                                                                />
                                                                            </label>
                                                                            <label className="rulesField">
                                                                                <span>Document URL</span>
                                                                                <input
                                                                                    className="modal_input"
                                                                                    value={item.documentUrl ?? ""}
                                                                                    onChange={(event) =>
                                                                                        updateRuleEditorItem(index, "documentUrl", event.target.value)
                                                                                    }
                                                                                />
                                                                            </label>
                                                                            <label className="rulesField">
                                                                                <span>Page</span>
                                                                                <input
                                                                                    className="modal_input"
                                                                                    value={item.pageReference ?? ""}
                                                                                    onChange={(event) =>
                                                                                        updateRuleEditorItem(index, "pageReference", event.target.value)
                                                                                    }
                                                                                />
                                                                            </label>
                                                                        </>
                                                                    ) : null}
                                                                    <label className="rulesField">
                                                                        <span>Usage</span>
                                                                        <select
                                                                            className="modal_input"
                                                                            value={`${item.usedInContract ? "contract" : ""}|${item.usedInPayroll ? "payroll" : ""}`}
                                                                            onChange={(event) => {
                                                                                const [contractUsage, payrollUsage] = event.target.value.split("|");
                                                                                updateRuleEditorItem(index, "usedInContract", contractUsage === "contract");
                                                                                updateRuleEditorItem(index, "usedInPayroll", payrollUsage === "payroll");
                                                                            }}
                                                                        >
                                                                            <option value="contract|payroll">Contract and payroll</option>
                                                                            <option value="contract|">Contract only</option>
                                                                            <option value="|payroll">Payroll only</option>
                                                                            <option value="|">Reference only</option>
                                                                        </select>
                                                                    </label>
                                                                    <label className="rulesField rulesFieldFull">
                                                                        <span>Source note</span>
                                                                        <textarea
                                                                            className="modal_input planningWizardTextarea"
                                                                            rows={3}
                                                                            value={item.sourceNote ?? ""}
                                                                            onChange={(event) =>
                                                                                updateRuleEditorItem(index, "sourceNote", event.target.value)
                                                                            }
                                                                        />
                                                                    </label>
                                                                </div>
                                                            </div>
                                                        ) : null}
                                                    </section>
                                                );
                                            })}
                                        </div>
                                        {ruleEditorError ? <div className="roleWizardAlert roleWizardAlert--error">{ruleEditorError}</div> : null}
                                        <div className="roleWizardActions planningWizardActions">
                                            <button
                                                type="button"
                                                className="buttonSecondary planningWizardCancel"
                                                onClick={closeRuleEditor}
                                                disabled={isRulePublishPending}
                                            >
                                                Cancel
                                            </button>
                                            <button type="submit" className="roleWizardPrimary" disabled={isRulePublishPending}>
                                                {isRulePublishPending ? "Saving..." : "Save section"}
                                            </button>
                                        </div>
                                    </form>
                                ) : null}
                            </Modal>

                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}
