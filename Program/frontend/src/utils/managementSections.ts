import type { NavItem } from "./permissionPolicy";

type ManagementSectionKey = "people" | "planning" | "payroll" | "contracts" | "company";

export type ManagementSection = {
    key: ManagementSectionKey | "other";
    title: string;
    description: string;
    items: NavItem[];
};

const SECTION_DETAILS: Record<ManagementSectionKey, Omit<ManagementSection, "items">> = {
    people: {
        key: "people",
        title: "People",
        description: "Employee records, profiles, and onboarding.",
    },
    planning: {
        key: "planning",
        title: "Planning",
        description: "Projects, shifts, clients, and staffing work.",
    },
    payroll: {
        key: "payroll",
        title: "Payroll",
        description: "Payslips, review queues, travel claims, and pay checks.",
    },
    contracts: {
        key: "contracts",
        title: "Contracts",
        description: "Employee contract lists, signatures, and management review.",
    },
    company: {
        key: "company",
        title: "Company",
        description: "Company settings, roles, and workflow setup.",
    },
};

const SECTION_ORDER: ManagementSectionKey[] = ["people", "planning", "payroll", "contracts", "company"];

const SECTION_BY_LABEL: Record<string, ManagementSectionKey> = {
    Users: "people",
    Messages: "people",
    Applications: "people",
    Onboarding: "people",
    "Onboarding review": "people",
    Planning: "planning",
    Clients: "planning",
    "Travel claims": "payroll",
    "All payslips": "payroll",
    "Payslip review": "payroll",
    Contracts: "contracts",
    "Horeca Payroll and Contract Rules": "contracts",
    "Company settings": "company",
};

export function buildManagementSections(items: NavItem[]): ManagementSection[] {
    const grouped = new Map<ManagementSectionKey, NavItem[]>();
    const otherItems: NavItem[] = [];

    items.forEach((item) => {
        const key = SECTION_BY_LABEL[item.label];
        if (!key) {
            otherItems.push(item);
            return;
        }

        grouped.set(key, [...(grouped.get(key) ?? []), item]);
    });

    const sections = SECTION_ORDER.flatMap((key) => {
        const sectionItems = grouped.get(key) ?? [];
        return sectionItems.length > 0 ? [{ ...SECTION_DETAILS[key], items: sectionItems }] : [];
    });

    if (otherItems.length > 0) {
        sections.push({
            key: "other",
            title: "Other tools",
            description: "Additional management tools available to your account.",
            items: otherItems,
        });
    }

    return sections;
}
