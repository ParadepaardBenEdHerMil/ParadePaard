export type PermissionName = string;
export const PLATFORM_ADMIN_PERMISSION = "CAN_MANAGE_PLATFORM";

export type NavItem = {
    label: string;
    to: string;
    permissions: PermissionName[];
};

export const ROLE_MANAGEMENT_PERMISSIONS = [
    "CAN_CREATE_ROLE",
    "CAN_ASSIGN_ROLES",
    "CAN_EDIT_ROLES",
    "CAN_REMOVE_ROLES",
    "CAN_DELETE_ROLES",
];

export const COMPANY_SETTINGS_PERMISSIONS = [
    "CAN_MANAGE_COMPANY",
    ...ROLE_MANAGEMENT_PERMISSIONS,
];

export const CAO_MANAGEMENT_PERMISSIONS = [
    "CAN_MANAGE_COMPANY",
];

export const PAYROLL_FINANCE_PERMISSIONS = [
    "CAN_VIEW_PAYROLL_FINANCE",
    "CAN_MANAGE_PAYROLL_FINANCE",
];

export const BILLING_RATE_PERMISSIONS = [
    "CAN_VIEW_BILLING_RATES",
    "CAN_MANAGE_BILLING_RATES",
];

export const ONBOARDING_REVIEW_PERMISSIONS = [
    "CAN_VIEW_ONBOARDING_QUEUE",
    "CAN_REVIEW_ONBOARDING",
];

export const APPLICATION_REVIEW_PERMISSIONS = [
    "CAN_VIEW_APPLICATIONS",
    "CAN_REVIEW_APPLICATIONS",
];

export const CONTRACT_WORKSPACE_PERMISSIONS = [
    "CAN_VIEW_ALL_CONTRACTS",
    "CAN_MANAGE_CONTRACTS",
    "CAN_REVIEW_CONTRACTS",
    "CAN_FINALIZE_CONTRACT",
];

export const CONTRACT_MANAGEMENT_PERMISSIONS = [
    ...ONBOARDING_REVIEW_PERMISSIONS,
    ...CONTRACT_WORKSPACE_PERMISSIONS,
];

export const FUNCTION_MANAGEMENT_PERMISSIONS = [
    "CAN_VIEW_FUNCTIONS",
    "CAN_MANAGE_FUNCTIONS",
];

export const OWN_CONTRACT_PERMISSIONS = [
    "CAN_VIEW_OWN_CONTRACTS",
    "CAN_SIGN_OWN_CONTRACTS",
];

// Lets an admin see employee identification fields (BSN, ID document type and
// number, issue/expiration dates, issuing country). Without it those fields
// are masked in the admin UI even for users who can otherwise see the rest of
// the employee profile and contract.
export const EMPLOYEE_IDENTIFICATION_PERMISSION = "CAN_VIEW_EMPLOYEE_IDENTIFICATION";
export const DELETE_USERS_PERMISSION = "CAN_DELETE_USERS";

export const MANAGEMENT_PERMISSIONS = [
    PLATFORM_ADMIN_PERMISSION,
    "CAN_ACCESS_ADMIN_DASHBOARD",
    "CAN_VIEW_USERS",
    "CAN_MANAGE_USERS",
    DELETE_USERS_PERMISSION,
    "CAN_MANAGE_PLANNING",
    "CAN_VIEW_ALL_TIMESHEETS",
    "CAN_MANAGE_TIMESHEETS",
    "CAN_VIEW_ALL_PAYSLIPS",
    "CAN_REVIEW_PAYSLIPS",
    "CAN_MANAGE_PAYSLIPS",
    "CAN_MANAGE_MESSAGES",
    "CAN_MANAGE_COMPANY",
    EMPLOYEE_IDENTIFICATION_PERMISSION,
    ...BILLING_RATE_PERMISSIONS,
    ...PAYROLL_FINANCE_PERMISSIONS,
    ...APPLICATION_REVIEW_PERMISSIONS,
    ...CONTRACT_MANAGEMENT_PERMISSIONS,
    ...FUNCTION_MANAGEMENT_PERMISSIONS,
    ...ROLE_MANAGEMENT_PERMISSIONS,
];

export const MANAGEMENT_NAV_ITEMS: NavItem[] = [
    { label: "Users", to: "/management/users", permissions: ["CAN_VIEW_USERS"] },
    { label: "Messages", to: "/management/messages", permissions: ["CAN_MANAGE_MESSAGES"] },
    {
        label: "Applications",
        to: "/management/applications",
        permissions: APPLICATION_REVIEW_PERMISSIONS,
    },
    {
        label: "Onboarding review",
        to: "/management/onboarding-review",
        permissions: ONBOARDING_REVIEW_PERMISSIONS,
    },
    {
        label: "Contracts",
        to: "/management/contracts",
        permissions: CONTRACT_WORKSPACE_PERMISSIONS,
    },
    { label: "Planning", to: "/management/planning", permissions: ["CAN_MANAGE_PLANNING"] },
    { label: "Clients", to: "/management/clients", permissions: ["CAN_MANAGE_PLANNING"] },
    { label: "Locations", to: "/management/locations", permissions: ["CAN_MANAGE_PLANNING"] },
    { label: "Job functions", to: "/management/functions", permissions: FUNCTION_MANAGEMENT_PERMISSIONS },
    { label: "Email presets", to: "/management/email-presets", permissions: ["CAN_MANAGE_MESSAGES"] },
    { label: "Work history", to: "/management/work-history", permissions: ["CAN_VIEW_ALL_TIMESHEETS"] },
    { label: "Travel claims", to: "/management/travel-claims", permissions: ["CAN_MANAGE_TIMESHEETS"] },
    { label: "All payslips", to: "/payslips?scope=all", permissions: ["CAN_VIEW_ALL_PAYSLIPS"] },
    { label: "Payslip review", to: "/management/payslip-review", permissions: ["CAN_REVIEW_PAYSLIPS"] },
    { label: "Company settings", to: "/account/company", permissions: COMPANY_SETTINGS_PERMISSIONS },
    {
        // Opens the sector landing page (cards per sector); each sector links to its own
        // rules page. Horeca is the only sector for now.
        label: "Payroll and contract rules",
        to: "/management/contract-rules",
        permissions: CAO_MANAGEMENT_PERMISSIONS,
    },
    {
        label: "Payroll Finance",
        to: "/management/payroll-finance",
        permissions: PAYROLL_FINANCE_PERMISSIONS,
    },
    {
        label: "Audit log",
        to: "/management/audit-log",
        permissions: CAO_MANAGEMENT_PERMISSIONS,
    },
];

export const hasPermission = (
    permissions: readonly PermissionName[] | null | undefined,
    permission: PermissionName
) => {
    return Boolean(permissions?.includes(permission));
};

export const hasAnyPermission = (
    permissions: readonly PermissionName[] | null | undefined,
    required: readonly PermissionName[]
) => {
    return required.some((permission) => hasPermission(permissions, permission));
};

export const hasAllPermissions = (
    permissions: readonly PermissionName[] | null | undefined,
    required: readonly PermissionName[]
) => {
    return required.every((permission) => hasPermission(permissions, permission));
};

export const canAccessManagement = (permissions: readonly PermissionName[] | null | undefined) => {
    return hasAnyPermission(permissions, MANAGEMENT_PERMISSIONS);
};

export const canAccessPlatform = (permissions: readonly PermissionName[] | null | undefined) => {
    return hasPermission(permissions, PLATFORM_ADMIN_PERMISSION);
};

export const canAccessCompanySettings = (permissions: readonly PermissionName[] | null | undefined) => {
    return hasAnyPermission(permissions, COMPANY_SETTINGS_PERMISSIONS);
};

export const canViewPayslips = (permissions: readonly PermissionName[] | null | undefined) => {
    return hasAnyPermission(permissions, ["CAN_VIEW_PAYSLIPS", "CAN_VIEW_ALL_PAYSLIPS"]);
};

export const canViewEmployeeIdentification = (
    permissions: readonly PermissionName[] | null | undefined
) => {
    return hasPermission(permissions, EMPLOYEE_IDENTIFICATION_PERMISSION);
};

export const canDeleteUsers = (
    permissions: readonly PermissionName[] | null | undefined
) => {
    return hasPermission(permissions, DELETE_USERS_PERMISSION);
};

export const getManagementNavItems = (permissions: readonly PermissionName[] | null | undefined) => {
    return MANAGEMENT_NAV_ITEMS.filter((item) => hasAnyPermission(permissions, item.permissions));
};

// Labels of the nav items consolidated under the Finance hub page.
export const FINANCE_NAV_LABELS = [
    "Work history",
    "Travel claims",
    "All payslips",
    "Payslip review",
    "Payroll Finance",
];

// Any of these grants access to the Finance hub (its tiles are still gated individually).
export const FINANCE_HUB_PERMISSIONS = [
    "CAN_VIEW_ALL_TIMESHEETS",
    "CAN_MANAGE_TIMESHEETS",
    "CAN_VIEW_ALL_PAYSLIPS",
    "CAN_REVIEW_PAYSLIPS",
    ...PAYROLL_FINANCE_PERMISSIONS,
];

export const getFinanceNavItems = (permissions: readonly PermissionName[] | null | undefined) => {
    return MANAGEMENT_NAV_ITEMS.filter(
        (item) => FINANCE_NAV_LABELS.includes(item.label) && hasAnyPermission(permissions, item.permissions)
    );
};
