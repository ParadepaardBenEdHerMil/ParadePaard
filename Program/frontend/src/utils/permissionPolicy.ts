export type PermissionName = string;

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
    "CAN_ACCESS_ADMIN_DASHBOARD",
    "CAN_MANAGE_COMPANY",
    "CAN_VIEW_PAYROLL_FINANCE",
    "CAN_MANAGE_PAYROLL_FINANCE",
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

export const OWN_CONTRACT_PERMISSIONS = [
    "CAN_VIEW_OWN_CONTRACTS",
    "CAN_SIGN_OWN_CONTRACTS",
];

export const MANAGEMENT_PERMISSIONS = [
    "CAN_ACCESS_ADMIN_DASHBOARD",
    "CAN_VIEW_USERS",
    "CAN_MANAGE_USERS",
    "CAN_ONBOARD_USERS",
    "CAN_MANAGE_PLANNING",
    "CAN_VIEW_ALL_TIMESHEETS",
    "CAN_MANAGE_TIMESHEETS",
    "CAN_VIEW_ALL_PAYSLIPS",
    "CAN_REVIEW_PAYSLIPS",
    "CAN_MANAGE_PAYSLIPS",
    "CAN_MANAGE_MESSAGES",
    "CAN_MANAGE_COMPANY",
    ...PAYROLL_FINANCE_PERMISSIONS,
    ...APPLICATION_REVIEW_PERMISSIONS,
    ...CONTRACT_MANAGEMENT_PERMISSIONS,
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
    { label: "Onboarding", to: "/management/onboarding", permissions: ["CAN_ONBOARD_USERS"] },
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
    { label: "Travel claims", to: "/management/travel-claims", permissions: ["CAN_MANAGE_TIMESHEETS"] },
    { label: "All payslips", to: "/payslips?scope=all", permissions: ["CAN_VIEW_ALL_PAYSLIPS"] },
    { label: "Payslip review", to: "/management/payslip-review", permissions: ["CAN_REVIEW_PAYSLIPS"] },
    { label: "Company settings", to: "/account/company", permissions: COMPANY_SETTINGS_PERMISSIONS },
    {
        label: "Horeca Payroll and Contract Rules",
        to: "/management/horeca-payroll-rules",
        permissions: CAO_MANAGEMENT_PERMISSIONS,
    },
    {
        label: "Payroll Finance",
        to: "/management/payroll-finance",
        permissions: PAYROLL_FINANCE_PERMISSIONS,
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

export const canAccessCompanySettings = (permissions: readonly PermissionName[] | null | undefined) => {
    return hasAnyPermission(permissions, COMPANY_SETTINGS_PERMISSIONS);
};

export const canViewPayslips = (permissions: readonly PermissionName[] | null | undefined) => {
    return hasAnyPermission(permissions, ["CAN_VIEW_PAYSLIPS", "CAN_VIEW_ALL_PAYSLIPS"]);
};

export const getManagementNavItems = (permissions: readonly PermissionName[] | null | undefined) => {
    return MANAGEMENT_NAV_ITEMS.filter((item) => hasAnyPermission(permissions, item.permissions));
};
