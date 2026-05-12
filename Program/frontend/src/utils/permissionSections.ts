export type PermissionSection = {
    title: string;
    permissions: string[];
};

type PermissionSectionDefinition = {
    title: string;
    permissions: string[];
};

const permissionLabelOverrides: Record<string, string> = {
    CAN_ACCESS_ADMIN_DASHBOARD: "Access management dashboard",
    CAN_ASSIGN_ROLES: "Assign roles to users",
    CAN_CREATE_ROLE: "Create roles",
    CAN_EDIT_ROLES: "Edit role definitions",
    CAN_DELETE_ROLES: "Delete roles",
    CAN_MANAGE_USERS: "Manage users",
    CAN_MANAGE_COMPANY: "Manage company profile",
    CAN_MANAGE_PLANNING: "Manage planning",
    CAN_VIEW_USERS: "View users",
    CAN_REMOVE_ROLES: "Remove roles from users",
    CAN_VIEW_OWN_CONTRACTS: "View own contracts",
    CAN_SIGN_OWN_CONTRACTS: "Sign own contracts",
    CAN_VIEW_ONBOARDING_QUEUE: "View onboarding queue",
    CAN_REVIEW_ONBOARDING: "Review onboarding",
    CAN_VIEW_ALL_CONTRACTS: "View all contracts",
    CAN_MANAGE_CONTRACTS: "Manage contracts",
    CAN_REVIEW_CONTRACTS: "Review signed contracts",
    CAN_FINALIZE_CONTRACT: "Finalize contracts",
};

const SECTION_DEFINITIONS: PermissionSectionDefinition[] = [
    {
        title: "Role access",
        permissions: [
            "CAN_ACCESS_ADMIN_DASHBOARD",
            "CAN_CREATE_ROLE",
            "CAN_EDIT_ROLES",
            "CAN_DELETE_ROLES",
            "CAN_ASSIGN_ROLES",
            "CAN_REMOVE_ROLES",
        ],
    },
    {
        title: "People",
        permissions: [
            "CAN_VIEW_USERS",
            "CAN_MANAGE_USERS",
            "CAN_ONBOARD_USERS",
            "CAN_VIEW_ONBOARDING_QUEUE",
            "CAN_REVIEW_ONBOARDING",
        ],
    },
    {
        title: "Contracts",
        permissions: [
            "CAN_VIEW_ALL_CONTRACTS",
            "CAN_MANAGE_CONTRACTS",
            "CAN_REVIEW_CONTRACTS",
            "CAN_FINALIZE_CONTRACT",
        ],
    },
    {
        title: "Self service",
        permissions: ["CAN_VIEW_OWN_CONTRACTS", "CAN_SIGN_OWN_CONTRACTS"],
    },
    {
        title: "Planning",
        permissions: ["CAN_MANAGE_PLANNING"],
    },
    {
        title: "Timesheets and travel",
        permissions: ["CAN_VIEW_ALL_TIMESHEETS", "CAN_MANAGE_TIMESHEETS"],
    },
    {
        title: "Payslips",
        permissions: [
            "CAN_VIEW_PAYSLIPS",
            "CAN_VIEW_ALL_PAYSLIPS",
            "CAN_REVIEW_PAYSLIPS",
            "CAN_MANAGE_PAYSLIPS",
        ],
    },
    {
        title: "Company settings",
        permissions: ["CAN_MANAGE_COMPANY"],
    },
];

const SECTION_PERMISSION_SET = new Set<string>(SECTION_DEFINITIONS.flatMap((section) => section.permissions));

export const formatPermission = (value: string) => {
    if (permissionLabelOverrides[value]) return permissionLabelOverrides[value];
    const trimmed = value.replace(/^CAN_/, "");
    return trimmed
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .map((word) => word[0]?.toUpperCase() + word.slice(1))
        .join(" ");
};

const sortPermissions = (permissions: string[]) => {
    return [...permissions].sort((a, b) => formatPermission(a).localeCompare(formatPermission(b)));
};

export const buildPermissionSections = (permissions: string[]): PermissionSection[] => {
    const available = new Set(permissions);
    const sections: PermissionSection[] = SECTION_DEFINITIONS.map((section) => ({
        title: section.title,
        permissions: sortPermissions(section.permissions.filter((permission) => available.has(permission))),
    })).filter((section) => section.permissions.length > 0);

    const otherPermissions = sortPermissions(permissions.filter((permission) => !SECTION_PERMISSION_SET.has(permission)));
    if (otherPermissions.length > 0) {
        sections.push({
            title: "Other",
            permissions: otherPermissions,
        });
    }

    return sections;
};
