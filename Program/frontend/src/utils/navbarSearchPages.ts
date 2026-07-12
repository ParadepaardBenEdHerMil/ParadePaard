import {
    canAccessCompanySettings,
    canAccessManagement,
    canAccessPlatform,
    canViewPayslips,
    getManagementNavItems,
    type PermissionName,
} from "./permissionPolicy";

export type NavbarSearchPage = {
    kind: "page";
    label: string;
    to: string;
    section: "Main" | "Management";
    searchText: string;
};

const MAIN_PAGES: NavbarSearchPage[] = [
    { kind: "page", label: "Dashboard", to: "/dashboard", section: "Main", searchText: "dashboard home" },
    {
        kind: "page",
        label: "Contracts",
        to: "/account/employment",
        section: "Main",
        searchText: "contracts employment account",
    },
    {
        kind: "page",
        label: "My planning",
        to: "/my-planning",
        section: "Main",
        searchText: "planning schedule shifts my planning",
    },
    { kind: "page", label: "Work history", to: "/my-finance/work-history", section: "Main", searchText: "work history timesheets hours" },
    { kind: "page", label: "Messages", to: "/messages", section: "Main", searchText: "messages inbox chat" },
    { kind: "page", label: "Account", to: "/account", section: "Main", searchText: "account profile settings" },
];

export function getSearchableNavbarPages(
    permissions: readonly PermissionName[] | null | undefined
): NavbarSearchPage[] {
    const pages = [...MAIN_PAGES];

    if (canAccessManagement(permissions)) {
        pages.push({
            kind: "page",
            label: "Management",
            to: "/management",
            section: "Management",
            searchText: "management admin",
        });
    }

    if (canAccessPlatform(permissions)) {
        pages.push({
            kind: "page",
            label: "Platform",
            to: "/platform",
            section: "Management",
            searchText: "platform companies onboarding super admin",
        });
    }

    if (canViewPayslips(permissions)) {
        pages.push({
            kind: "page",
            label: "Payslips",
            to: "/payslips",
            section: "Main",
            searchText: "payslips payroll salary",
        });
    }

    pages.push(
        ...getManagementNavItems(permissions)
            .filter((item) => item.label !== "Messages")
            .map((item) => ({
                kind: "page" as const,
                label: item.label,
                to: item.to,
                section: "Management" as const,
                searchText: `${item.label} management ${item.to}`.toLowerCase(),
            }))
    );

    if (canAccessCompanySettings(permissions)) {
        pages.push({
            kind: "page",
            label: "Company settings",
            to: "/account/company",
            section: "Management",
            searchText: "company settings roles management",
        });
    }

    return pages.filter(
        (page, index, all) =>
            all.findIndex((candidate) => candidate.to === page.to && candidate.label === page.label) === index
    );
}
