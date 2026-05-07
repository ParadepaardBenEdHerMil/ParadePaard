import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import { useAuth } from "../context/AuthContext";
import { AuthServices, type RoleResponseDTO } from "../services/auth-service/AuthServices";
import {
    UserServices,
    type CompanyResponseDTO,
    type PayrollTaxTemplateDTO,
    type UserResponseDTO,
} from "../services/user-service/UserServices";
import { buildPermissionSections, formatPermission } from "../utils/permissionSections";
import "../stylesheets/Settings.css";

const roleColorOptions = [
    "#2f6bff",
    "#16a34a",
    "#0ea5e9",
    "#f97316",
    "#e11d48",
    "#7c3aed",
    "#f59e0b",
    "#14b8a6",
];

const normalizeRoleName = (value: string) => value.trim().toUpperCase();

const displayNameForUser = (user: UserResponseDTO) => {
    const parts = [user.firstNames, user.middleNamePrefix, user.lastName]
        .map((part) => (part ?? "").trim())
        .filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    const preferred = (user.preferredName ?? "").trim();
    return preferred || user.email;
};

const MINUTES_PER_DAY = 60 * 24;

const formatPayoutFrequency = (minutes: number | null | undefined) => {
    if (!minutes || minutes <= 0) return "-";
    const frequencyMap = new Map<number, string>([
        [60 * 24 * 7, "Weekly"],
        [60 * 24 * 14, "Bi-weekly"],
        [60 * 24 * 30, "Monthly"],
    ]);
    const preset = frequencyMap.get(minutes);
    if (preset) return preset;
    if (minutes % MINUTES_PER_DAY === 0) {
        const days = minutes / MINUTES_PER_DAY;
        return `Every ${days} day${days === 1 ? "" : "s"}`;
    }

    const days = Math.floor(minutes / MINUTES_PER_DAY);
    const hours = Math.floor((minutes % MINUTES_PER_DAY) / 60);
    const remainingMinutes = minutes % 60;
    const parts = [
        days > 0 ? `${days} day${days === 1 ? "" : "s"}` : null,
        hours > 0 ? `${hours} hour${hours === 1 ? "" : "s"}` : null,
        remainingMinutes > 0 ? `${remainingMinutes} min` : null,
    ].filter(Boolean);

    if (parts.length === 1) return `Every ${parts[0]}`;
    if (parts.length === 2) return `Every ${parts[0]} and ${parts[1]}`;
    return `Every ${parts[0]}, ${parts[1]}, and ${parts[2]}`;
};

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const PAYOUT_FREQUENCY_SEPARATOR = ":";
const PAYOUT_FREQUENCY_PART_WIDTH = 2;

const payoutFrequencyMinutesToDraft = (minutes: number | null | undefined) => {
    if (!minutes || minutes <= 0) return "07:00:00";
    const days = Math.floor(minutes / MINUTES_PER_DAY);
    const hours = Math.floor((minutes % MINUTES_PER_DAY) / MINUTES_PER_HOUR);
    const remainingMinutes = minutes % MINUTES_PER_HOUR;
    return [
        String(days).padStart(2, "0"),
        String(hours).padStart(2, "0"),
        String(remainingMinutes).padStart(2, "0"),
    ].join(PAYOUT_FREQUENCY_SEPARATOR);
};

const formatPayoutFrequencyDraftInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, PAYOUT_FREQUENCY_PART_WIDTH * 3);
    if (digits.length <= PAYOUT_FREQUENCY_PART_WIDTH) return digits;
    if (digits.length <= PAYOUT_FREQUENCY_PART_WIDTH * 2) {
        return `${digits.slice(0, PAYOUT_FREQUENCY_PART_WIDTH)}${PAYOUT_FREQUENCY_SEPARATOR}${digits.slice(PAYOUT_FREQUENCY_PART_WIDTH)}`;
    }
    return [
        digits.slice(0, PAYOUT_FREQUENCY_PART_WIDTH),
        digits.slice(PAYOUT_FREQUENCY_PART_WIDTH, PAYOUT_FREQUENCY_PART_WIDTH * 2),
        digits.slice(PAYOUT_FREQUENCY_PART_WIDTH * 2),
    ].join(PAYOUT_FREQUENCY_SEPARATOR);
};

const parsePayoutFrequencyMinutes = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return null;

    const parts = normalized.split(/\D+/).filter(Boolean);
    if (parts.length !== 3) return null;
    if (!parts.every((part) => /^\d+$/.test(part))) return null;

    const [days, hours, minutes] = parts.map((part) => Number(part));
    if (
        !Number.isFinite(days)
        || !Number.isFinite(hours)
        || !Number.isFinite(minutes)
        || days < 0
        || hours < 0
        || hours >= HOURS_PER_DAY
        || minutes < 0
        || minutes >= MINUTES_PER_HOUR
    ) {
        return null;
    }

    const totalMinutes = (days * MINUTES_PER_DAY) + (hours * MINUTES_PER_HOUR) + minutes;
    return totalMinutes > 0 ? totalMinutes : null;
};

const suggestedPayrollTaxTemplates: PayrollTaxTemplateDTO[] = [
    {
        code: "LOONHEFFING",
        label: "Loonheffing",
        category: "TAX",
        calculationType: "FIXED_AMOUNT",
        configuredValue: null,
        active: false,
        sortOrder: 10,
        notes: "",
        employeeProfileTrigger: "ALWAYS",
    },
    {
        code: "PENSION_EMPLOYEE",
        label: "Employee pension",
        category: "PENSION",
        calculationType: "FIXED_AMOUNT",
        configuredValue: null,
        active: false,
        sortOrder: 20,
        notes: "",
        employeeProfileTrigger: "PENSION_PARTICIPANT",
    },
    {
        code: "HOP_EMPLOYEE",
        label: "HOP employee contribution",
        category: "CAO",
        calculationType: "FIXED_AMOUNT",
        configuredValue: null,
        active: false,
        sortOrder: 30,
        notes: "",
        employeeProfileTrigger: "ALWAYS",
    },
    {
        code: "PAWW",
        label: "PAWW",
        category: "INSURANCE",
        calculationType: "FIXED_AMOUNT",
        configuredValue: null,
        active: false,
        sortOrder: 40,
        notes: "",
        employeeProfileTrigger: "ALWAYS",
    },
    {
        code: "ZVW_EMPLOYEE_SPECIAL",
        label: "Employee Zvw contribution",
        category: "TAX",
        calculationType: "FIXED_AMOUNT",
        configuredValue: null,
        active: false,
        sortOrder: 50,
        notes: "",
        employeeProfileTrigger: "SPECIAL_ZVW_CONTRIBUTION",
    },
    {
        code: "OTHER_DEDUCTION",
        label: "Other deduction",
        category: "OTHER",
        calculationType: "FIXED_AMOUNT",
        configuredValue: null,
        active: false,
        sortOrder: 60,
        notes: "",
        employeeProfileTrigger: "ALWAYS",
    },
];

const normalizePayrollTaxTemplates = (templates?: PayrollTaxTemplateDTO[] | null): PayrollTaxTemplateDTO[] => {
    const source = templates && templates.length > 0 ? templates : suggestedPayrollTaxTemplates;
    return source.map((template, index) => ({
        code: template.code ?? "",
        label: template.label ?? "",
        category: template.category ?? "OTHER",
        calculationType: template.calculationType ?? "FIXED_AMOUNT",
        configuredValue: template.configuredValue ?? null,
        active: template.active ?? false,
        sortOrder: template.sortOrder ?? ((index + 1) * 10),
        notes: template.notes ?? "",
        employeeProfileTrigger: template.employeeProfileTrigger ?? "ALWAYS",
    }));
};

const isDutchTaxTemplate = (template: PayrollTaxTemplateDTO) => {
    const category = (template.category ?? "").trim().toUpperCase();
    return category === "TAX";
};

type CompanySettingsTab = "details" | "roles" | "workflow" | "tax";

const normalizeCompanySettingsTab = (value: string | null): CompanySettingsTab => {
    if (value === "roles" || value === "workflow" || value === "tax") return value;
    return "details";
};

export default function SettingsCompany() {
    const [searchParams] = useSearchParams();
    const activeTab = normalizeCompanySettingsTab(searchParams.get("tab"));
    const { permissions, permissionsLoading, permissionsError } = useAuth();

    const [roles, setRoles] = useState<RoleResponseDTO[]>([]);
    const [rolesLoading, setRolesLoading] = useState(false);
    const [rolesError, setRolesError] = useState<string | null>(null);

    const [permissionCatalog, setPermissionCatalog] = useState<string[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogError, setCatalogError] = useState<string | null>(null);

    const [users, setUsers] = useState<UserResponseDTO[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState<string | null>(null);

    const [company, setCompany] = useState<CompanyResponseDTO | null>(null);
    const [companyLoading, setCompanyLoading] = useState(true);
    const [companyError, setCompanyError] = useState<string | null>(null);
    const [companyNameDraft, setCompanyNameDraft] = useState("");
    const [payoutFrequencyDraft, setPayoutFrequencyDraft] = useState("07:00:00");
    const [timesheetLoggingModeDraft, setTimesheetLoggingModeDraft] = useState("ADMIN_FINALIZE");
    const [travelClaimModeDraft, setTravelClaimModeDraft] = useState("REQUIRES_APPROVAL");
    const [payrollTaxTemplatesDraft, setPayrollTaxTemplatesDraft] = useState<PayrollTaxTemplateDTO[]>([]);
    const [companySaving, setCompanySaving] = useState(false);
    const [companySaveError, setCompanySaveError] = useState<string | null>(null);
    const [companySaveSuccess, setCompanySaveSuccess] = useState<string | null>(null);
    const [companyLogoUrl, setCompanyLogoUrl] = useState<string | null>(null);
    const [companyLogoLoading, setCompanyLogoLoading] = useState(false);
    const [companyLogoError, setCompanyLogoError] = useState<string | null>(null);
    const [companyLogoSaving, setCompanyLogoSaving] = useState(false);

    const [roleName, setRoleName] = useState("");
    const [roleColor, setRoleColor] = useState(roleColorOptions[0] ?? "#2f6bff");
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createSuccess, setCreateSuccess] = useState<string | null>(null);
    const [creatingRole, setCreatingRole] = useState(false);
    const [createRoleOpen, setCreateRoleOpen] = useState(false);
    const [createStep, setCreateStep] = useState<"details" | "permissions" | "members">("details");
    const [createUserSearch, setCreateUserSearch] = useState("");
    const [selectedCreateUserIds, setSelectedCreateUserIds] = useState<string[]>([]);

    const [editRoleOpen, setEditRoleOpen] = useState(false);
    const [editRoleId, setEditRoleId] = useState<string | null>(null);
    const [editRoleName, setEditRoleName] = useState("");
    const [editRoleOriginalName, setEditRoleOriginalName] = useState("");
    const [editRoleColor, setEditRoleColor] = useState(roleColorOptions[0] ?? "#2f6bff");
    const [editPermissions, setEditPermissions] = useState<string[]>([]);
    const [editStep, setEditStep] = useState<"details" | "permissions" | "members" | "danger">("details");
    const [editError, setEditError] = useState<string | null>(null);
    const [editSuccess, setEditSuccess] = useState<string | null>(null);
    const [editSaving, setEditSaving] = useState(false);
    const [deletingRole, setDeletingRole] = useState(false);
    const [deleteConfirmName, setDeleteConfirmName] = useState("");
    const [roleMemberCounts, setRoleMemberCounts] = useState<Record<string, number>>({});
    const [roleMembersLoading, setRoleMembersLoading] = useState(false);
    const [roleMembersError, setRoleMembersError] = useState<string | null>(null);
    const [roleMemberRefreshKey, setRoleMemberRefreshKey] = useState(0);
    const [allUserRolesMap, setAllUserRolesMap] = useState<Record<string, string[]>>({});
    const [editUserSearch, setEditUserSearch] = useState("");
    const [selectedEditUserIds, setSelectedEditUserIds] = useState<string[]>([]);

    useEffect(() => {
        let cancelled = false;
        setCompanyLoading(true);
        setCompanyError(null);

        UserServices.getMyCompany()
            .then((data) => {
                if (!cancelled) setCompany(data);
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : "Failed to load company";
                if (!cancelled) setCompanyError(message);
            })
            .finally(() => {
                if (!cancelled) setCompanyLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!company) return;
        setCompanyNameDraft(company.name ?? "");
        setPayoutFrequencyDraft(payoutFrequencyMinutesToDraft(company.payoutFrequencyMinutes));
        setTimesheetLoggingModeDraft(company.timesheetLoggingMode ?? "ADMIN_FINALIZE");
        setTravelClaimModeDraft(company.travelClaimMode ?? "REQUIRES_APPROVAL");
        setPayrollTaxTemplatesDraft(normalizePayrollTaxTemplates(company.payrollTaxTemplates));
    }, [
        company?.name,
        company?.payrollTaxTemplates,
        company?.payoutFrequencyMinutes,
        company?.timesheetLoggingMode,
        company?.travelClaimMode,
    ]);

    useEffect(() => {
        if (!company) return;
        let cancelled = false;
        setCompanyLogoLoading(true);
        setCompanyLogoError(null);

        UserServices.getMyCompanyLogo()
            .then((blob) => {
                if (cancelled) return;
                setCompanyLogoUrl(blob ? URL.createObjectURL(blob) : null);
            })
            .catch(() => {
                if (!cancelled) setCompanyLogoUrl(null);
            })
            .finally(() => {
                if (!cancelled) setCompanyLogoLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [company?.companyId]);

    useEffect(() => {
        return () => {
            if (companyLogoUrl) URL.revokeObjectURL(companyLogoUrl);
        };
    }, [companyLogoUrl]);

    const canCreateRole = permissions.includes("CAN_CREATE_ROLE");
    const canAssignRoles = permissions.includes("CAN_ASSIGN_ROLES");
    const canRemoveRoles = permissions.includes("CAN_REMOVE_ROLES");
    const canEditRoles = permissions.includes("CAN_EDIT_ROLES");
    const canDeleteRoles = permissions.includes("CAN_DELETE_ROLES");
    const canViewUserRoles =
        permissions.includes("CAN_VIEW_USERS") || canAssignRoles || canRemoveRoles;
    const canManageRoles =
        canCreateRole || canAssignRoles || canRemoveRoles || canEditRoles || canDeleteRoles;
    const canManageCompany = permissions.includes("CAN_MANAGE_COMPANY");
    const canAccessSettings = canManageRoles || canManageCompany;

    useEffect(() => {
        if (!canManageRoles) return;
        let cancelled = false;
        setRolesLoading(true);
        setRolesError(null);

        AuthServices.getRoles()
            .then((data) => {
                if (!cancelled) setRoles(data ?? []);
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : "Failed to load roles";
                if (!cancelled) setRolesError(message);
            })
            .finally(() => {
                if (!cancelled) setRolesLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [canManageRoles]);

    useEffect(() => {
        if (!canCreateRole && !canEditRoles) return;
        let cancelled = false;
        setCatalogLoading(true);
        setCatalogError(null);

        AuthServices.getAllPermissions()
            .then((data) => {
                if (!cancelled) setPermissionCatalog(data ?? []);
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : "Failed to load permission catalog";
                if (!cancelled) setCatalogError(message);
            })
            .finally(() => {
                if (!cancelled) setCatalogLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [canCreateRole, canEditRoles]);

    useEffect(() => {
        if (!canViewUserRoles) return;
        let cancelled = false;
        setUsersLoading(true);
        setUsersError(null);

        UserServices.getUsers()
            .then((data) => {
                if (!cancelled) setUsers(data ?? []);
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : "Failed to load users";
                if (!cancelled) setUsersError(message);
            })
            .finally(() => {
                if (!cancelled) setUsersLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [canViewUserRoles]);

    useEffect(() => {
        if (createError) setCreateError(null);
    }, [roleName, roleColor, selectedPermissions, selectedCreateUserIds]);

    useEffect(() => {
        if (editError) setEditError(null);
        if (editSuccess) setEditSuccess(null);
    }, [editRoleName, editRoleColor, editPermissions]);

    useEffect(() => {
        setCompanySaveError(null);
        setCompanySaveSuccess(null);
    }, [activeTab]);

    const sortedRoles = useMemo(() => {
        return [...roles].sort((a, b) => a.name.localeCompare(b.name));
    }, [roles]);

    const sortedPermissions = useMemo(() => {
        const list = [...permissionCatalog];
        if (!list.includes("CAN_EDIT_ROLES")) list.push("CAN_EDIT_ROLES");
        if (!list.includes("CAN_DELETE_ROLES")) list.push("CAN_DELETE_ROLES");
        if (!list.includes("CAN_REMOVE_ROLES")) list.push("CAN_REMOVE_ROLES");
        return list.sort((a, b) => a.localeCompare(b));
    }, [permissionCatalog]);

    const permissionSections = useMemo(() => {
        return buildPermissionSections(sortedPermissions);
    }, [sortedPermissions]);

    const sortedUsers = useMemo(() => {
        return [...users].sort((a, b) => displayNameForUser(a).localeCompare(displayNameForUser(b)));
    }, [users]);

    const filteredCreateUsers = useMemo(() => {
        const term = createUserSearch.trim().toLowerCase();
        if (!term) return [];
        const selectedSet = new Set(selectedCreateUserIds);
        return sortedUsers.filter((user) => {
            if (selectedSet.has(user.userId)) return false;
            const name = displayNameForUser(user).toLowerCase();
            return name.includes(term) || user.email.toLowerCase().includes(term);
        });
    }, [createUserSearch, displayNameForUser, selectedCreateUserIds, sortedUsers]);

    const filteredEditUsers = useMemo(() => {
        const term = editUserSearch.trim().toLowerCase();
        if (!term) return [];
        const selectedSet = new Set(selectedEditUserIds);
        return sortedUsers.filter((user) => {
            if (selectedSet.has(user.userId)) return false;
            const name = displayNameForUser(user).toLowerCase();
            return name.includes(term) || user.email.toLowerCase().includes(term);
        });
    }, [displayNameForUser, editUserSearch, selectedEditUserIds, sortedUsers]);

    const selectedCreateUsers = useMemo(() => {
        const userMap = new Map(users.map((user) => [user.userId, user]));
        return selectedCreateUserIds
            .map((id) => userMap.get(id))
            .filter((user): user is UserResponseDTO => Boolean(user));
    }, [selectedCreateUserIds, users]);

    const selectedEditUsers = useMemo(() => {
        const userMap = new Map(users.map((user) => [user.userId, user]));
        return selectedEditUserIds
            .map((id) => userMap.get(id))
            .filter((user): user is UserResponseDTO => Boolean(user));
    }, [selectedEditUserIds, users]);

    useEffect(() => {
        if (!canViewUserRoles || users.length === 0) {
            setRoleMemberCounts({});
            setRoleMembersError(null);
            setRoleMembersLoading(false);
            setAllUserRolesMap({});
            return;
        }
        let cancelled = false;
        setRoleMembersLoading(true);
        setRoleMembersError(null);

        AuthServices.getUserRoles(users.map((user) => user.userId))
            .then((data) => {
                if (cancelled) return;
                const counts: Record<string, number> = {};
                const map: Record<string, string[]> = {};
                (data ?? []).forEach((entry) => {
                    map[entry.userId] = entry.roles ?? [];
                    (entry.roles ?? []).forEach((roleName) => {
                        const key = normalizeRoleName(roleName);
                        if (!key) return;
                        counts[key] = (counts[key] ?? 0) + 1;
                    });
                });
                setRoleMemberCounts(counts);
                setAllUserRolesMap(map);
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : "Failed to load member counts";
                if (!cancelled) setRoleMembersError(message);
            })
            .finally(() => {
                if (!cancelled) setRoleMembersLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [canViewUserRoles, roleMemberRefreshKey, users]);

    useEffect(() => {
        if (!editRoleOpen) return;
        if (selectedEditUserIds.length > 0) return;
        const roleKey = normalizeRoleName(editRoleOriginalName || editRoleName);
        if (!roleKey) return;
        const ids = Object.entries(allUserRolesMap)
            .filter(([, rolesForUser]) =>
                (rolesForUser ?? []).some((roleName) => normalizeRoleName(roleName) === roleKey)
            )
            .map(([userId]) => userId);
        setSelectedEditUserIds(ids);
    }, [allUserRolesMap, editRoleName, editRoleOpen, editRoleOriginalName, selectedEditUserIds.length]);

    const addCreateUser = useCallback(
        (user: UserResponseDTO) => {
            setSelectedCreateUserIds((prev) =>
                prev.includes(user.userId) ? prev : [...prev, user.userId]
            );
            if (createSuccess) setCreateSuccess(null);
        },
        [createSuccess]
    );

    const addEditUser = useCallback(
        (user: UserResponseDTO) => {
            setSelectedEditUserIds((prev) =>
                prev.includes(user.userId) ? prev : [...prev, user.userId]
            );
            if (editSuccess) setEditSuccess(null);
        },
        [editSuccess]
    );

    const canSubmitCreate =
        roleName.trim().length > 0 && selectedPermissions.length > 0 && !catalogLoading;

    const canManageRoleMembers = canAssignRoles || canRemoveRoles;

    const canSubmitEdit =
        Boolean(editRoleId) &&
        editRoleName.trim().length > 0 &&
        (!canEditRoles || editPermissions.length > 0) &&
        (canEditRoles || canManageRoleMembers) &&
        !editSaving &&
        !deletingRole;

    const showEditSaveButton = editStep !== "danger" && (canEditRoles || canManageRoleMembers);

    const canConfirmDelete =
        canDeleteRoles &&
        Boolean(editRoleId) &&
        normalizeRoleName(deleteConfirmName) ===
            normalizeRoleName(editRoleOriginalName || editRoleName);

    const memberCountLabel = (roleNameValue: string) => {
        if (!canViewUserRoles) return "N/A members";
        if (usersLoading) return "Loading...";
        if (roleMembersLoading) return "Loading...";
        if (roleMembersError) return "Members unavailable";
        const count = roleMemberCounts[normalizeRoleName(roleNameValue)] ?? 0;
        return `${count} member${count === 1 ? "" : "s"}`;
    };

    const companyOriginalName = (company?.name ?? "").trim();
    const companyDisplayName = companyOriginalName || "Company";
    const companyDraftName = companyNameDraft.trim();
    const companyAvatarName = companyDraftName || companyDisplayName;
    const companyInitial = (companyAvatarName[0] ?? "C").toUpperCase();
    const companyNameDirty = companyDraftName !== companyOriginalName;
    const payoutFrequencyMinutesDraft = parsePayoutFrequencyMinutes(payoutFrequencyDraft);
    const companyModesDirty =
        (company?.payoutFrequencyMinutes ?? 10080) !== payoutFrequencyMinutesDraft
        ||
        (company?.timesheetLoggingMode ?? "ADMIN_FINALIZE") !== timesheetLoggingModeDraft
        || (company?.travelClaimMode ?? "REQUIRES_APPROVAL") !== travelClaimModeDraft;
    const companyTaxTemplatesDirty = useMemo(() => {
        return JSON.stringify(normalizePayrollTaxTemplates(company?.payrollTaxTemplates))
            !== JSON.stringify(normalizePayrollTaxTemplates(payrollTaxTemplatesDraft));
    }, [company?.payrollTaxTemplates, payrollTaxTemplatesDraft]);
    const dutchTaxTemplates = useMemo(() => {
        return payrollTaxTemplatesDraft.filter(isDutchTaxTemplate);
    }, [payrollTaxTemplatesDraft]);
    const caoTaxTemplates = useMemo(() => {
        return payrollTaxTemplatesDraft.filter((template) => !isDutchTaxTemplate(template));
    }, [payrollTaxTemplatesDraft]);

    const tabCopy = {
        details: {
            title: "Company details",
            helper: "Manage your company name, branding, and basic profile information.",
        },
        roles: {
            title: "Roles and permissions",
            helper: "Control role definitions, permissions, and who belongs to each role.",
        },
        workflow: {
            title: "Workflow settings",
            helper: "Control company-wide timing for payslips, timesheets, and travel claims.",
        },
        tax: {
            title: "Tax settings",
            helper: "Maintain manual Dutch payroll deduction templates for horeca payslips.",
        },
    } satisfies Record<CompanySettingsTab, { title: string; helper: string }>;

    const handleSaveCompanyDetails = async (event?: React.FormEvent) => {
        if (event) event.preventDefault();
        if (!canManageCompany) return;
        if (!companyDraftName) {
            setCompanySaveError("Company name is required.");
            return;
        }
        if (!companyNameDirty) return;

        try {
            setCompanySaving(true);
            setCompanySaveError(null);
            setCompanySaveSuccess(null);
            const updated = await UserServices.updateMyCompany({
                name: companyDraftName,
            });
            setCompany(updated);
            setCompanyNameDraft(updated.name ?? companyDraftName);
            setCompanySaveSuccess("Company details updated.");
            window.dispatchEvent(new Event("companyUpdated"));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not update company details.";
            setCompanySaveError(message);
        } finally {
            setCompanySaving(false);
        }
    };

    const handleSaveWorkflowSettings = async (event?: React.FormEvent) => {
        if (event) event.preventDefault();
        if (!canManageCompany) return;
        if (payoutFrequencyMinutesDraft == null) {
            setCompanySaveError("Enter a valid payslip timing in dd:hh:mm.");
            return;
        }
        if (!companyModesDirty) return;

        try {
            setCompanySaving(true);
            setCompanySaveError(null);
            setCompanySaveSuccess(null);
            const updated = await UserServices.updateMyCompany({
                payoutFrequencyMinutes: payoutFrequencyMinutesDraft,
                timesheetLoggingMode: timesheetLoggingModeDraft,
                travelClaimMode: travelClaimModeDraft,
            });
            setCompany(updated);
            setPayoutFrequencyDraft(
                payoutFrequencyMinutesToDraft(updated.payoutFrequencyMinutes ?? payoutFrequencyMinutesDraft)
            );
            setTimesheetLoggingModeDraft(updated.timesheetLoggingMode ?? timesheetLoggingModeDraft);
            setTravelClaimModeDraft(updated.travelClaimMode ?? travelClaimModeDraft);
            setCompanySaveSuccess("Workflow settings updated.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not update workflow settings.";
            setCompanySaveError(message);
        } finally {
            setCompanySaving(false);
        }
    };

    const updatePayrollTaxTemplate = (index: number, patch: Partial<PayrollTaxTemplateDTO>) => {
        setPayrollTaxTemplatesDraft((prev) => prev.map((template, templateIndex) => {
            if (templateIndex !== index) return template;
            return { ...template, ...patch };
        }));
        if (companySaveError) setCompanySaveError(null);
        if (companySaveSuccess) setCompanySaveSuccess(null);
    };

    const handleAddPayrollTaxTemplate = () => {
        setPayrollTaxTemplatesDraft((prev) => ([
            ...prev,
            {
                code: "",
                label: "",
                category: "OTHER",
                calculationType: "FIXED_AMOUNT",
                configuredValue: null,
                active: false,
                sortOrder: ((prev.length + 1) * 10),
                notes: "",
                employeeProfileTrigger: "ALWAYS",
            },
        ]));
    };

    const handleRemovePayrollTaxTemplate = (index: number) => {
        setPayrollTaxTemplatesDraft((prev) => prev.filter((_, templateIndex) => templateIndex !== index));
        if (companySaveError) setCompanySaveError(null);
        if (companySaveSuccess) setCompanySaveSuccess(null);
    };

    const handleSaveTaxSettings = async (event?: React.FormEvent) => {
        if (event) event.preventDefault();
        if (!canManageCompany) return;
        if (!companyTaxTemplatesDirty) return;

        const normalizedTemplates = normalizePayrollTaxTemplates(payrollTaxTemplatesDraft).map((template) => ({
            ...template,
            code: template.code.trim().toUpperCase(),
            label: template.label.trim(),
            category: template.category.trim().toUpperCase(),
            calculationType: template.calculationType.trim().toUpperCase(),
            notes: template.notes?.trim() ?? "",
            employeeProfileTrigger: (template.employeeProfileTrigger ?? "ALWAYS").trim().toUpperCase(),
        }));

        if (normalizedTemplates.some((template) => !template.code || !template.label)) {
            setCompanySaveError("Each tax template needs a code and label.");
            return;
        }

        try {
            setCompanySaving(true);
            setCompanySaveError(null);
            setCompanySaveSuccess(null);
            const updated = await UserServices.updateMyCompany({
                payrollTaxTemplates: normalizedTemplates,
            });
            setCompany(updated);
            setPayrollTaxTemplatesDraft(normalizePayrollTaxTemplates(updated.payrollTaxTemplates));
            setCompanySaveSuccess("Tax settings updated.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not update tax settings.";
            setCompanySaveError(message);
        } finally {
            setCompanySaving(false);
        }
    };

    const handleSelectCompanyLogo = async (file: File | null) => {
        if (!file || !canManageCompany) return;
        if (!file.type.startsWith("image/")) {
            setCompanyLogoError("Please select an image file.");
            return;
        }
        if (file.size > 2_000_000) {
            setCompanyLogoError("Logo must be 2MB or smaller.");
            return;
        }

        try {
            setCompanyLogoSaving(true);
            setCompanyLogoError(null);
            await UserServices.updateMyCompanyLogo(file);
            const blob = await UserServices.getMyCompanyLogo();
            setCompanyLogoUrl(blob ? URL.createObjectURL(blob) : null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not upload company logo.";
            setCompanyLogoError(message);
        } finally {
            setCompanyLogoSaving(false);
        }
    };

    const handleRemoveCompanyLogo = async () => {
        if (!canManageCompany) return;
        try {
            setCompanyLogoSaving(true);
            setCompanyLogoError(null);
            await UserServices.deleteMyCompanyLogo();
            setCompanyLogoUrl(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not remove company logo.";
            setCompanyLogoError(message);
        } finally {
            setCompanyLogoSaving(false);
        }
    };

    const handleTogglePermission = (permission: string) => {
        setSelectedPermissions((prev) =>
            prev.includes(permission)
                ? prev.filter((p) => p !== permission)
                : [...prev, permission]
        );
        if (createSuccess) setCreateSuccess(null);
    };

    const handleToggleEditPermission = (permission: string) => {
        setEditPermissions((prev) =>
            prev.includes(permission)
                ? prev.filter((p) => p !== permission)
                : [...prev, permission]
        );
    };

    const renderPermissionSections = (
        selected: string[],
        onToggle: (permission: string) => void,
        disabled: boolean
    ) => {
        if (sortedPermissions.length === 0) {
            return <span className="roleWizardMeta">No permissions available.</span>;
        }

        return (
            <div className="rolePermissionSections">
                {permissionSections.map((section) => {
                    const selectedCount = section.permissions.filter((permission) =>
                        selected.includes(permission)
                    ).length;

                    return (
                        <section key={section.title} className="rolePermissionSection">
                            <div className="rolePermissionSectionHeader">
                                <span className="rolePermissionSectionTitle">{section.title}</span>
                                <span className="roleWizardMeta">
                                    {selectedCount}/{section.permissions.length}
                                </span>
                            </div>
                            <div className="rolePermissionSectionGrid">
                                {section.permissions.map((permission) => {
                                    const isSelected = selected.includes(permission);

                                    return (
                                        <label
                                            key={permission}
                                            className={`roleWizardCheckbox ${
                                                isSelected ? "roleWizardCheckbox--active" : ""
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => onToggle(permission)}
                                                disabled={disabled}
                                            />
                                            <span>{formatPermission(permission)}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </section>
                    );
                })}
            </div>
        );
    };

    const resetCreateRoleForm = () => {
        setRoleName("");
        setRoleColor(roleColorOptions[0] ?? "#2f6bff");
        setSelectedPermissions([]);
        setSelectedCreateUserIds([]);
        setCreateUserSearch("");
        setCreateStep("details");
        setCreateError(null);
        setCreateSuccess(null);
    };

    const resetEditRoleForm = () => {
        setEditRoleId(null);
        setEditRoleName("");
        setEditRoleOriginalName("");
        setEditRoleColor(roleColorOptions[0] ?? "#2f6bff");
        setEditPermissions([]);
        setEditStep("details");
        setEditError(null);
        setEditSuccess(null);
        setEditSaving(false);
        setDeletingRole(false);
        setDeleteConfirmName("");
        setEditUserSearch("");
        setSelectedEditUserIds([]);
    };

    const openCreateRoleModal = () => {
        resetCreateRoleForm();
        setCreateRoleOpen(true);
    };

    const closeCreateRoleModal = () => {
        setCreateRoleOpen(false);
        resetCreateRoleForm();
    };

    const openEditRoleModal = (role: RoleResponseDTO) => {
        if (!role.id) return;
        setEditRoleId(role.id);
        setEditRoleName(role.name ?? "");
        setEditRoleOriginalName(role.name ?? "");
        setEditRoleColor(role.color ?? roleColorOptions[0] ?? "#2f6bff");
        setEditPermissions(role.permissions ?? []);
        setEditStep("details");
        setEditError(null);
        setEditSuccess(null);
        setDeleteConfirmName("");
        setEditUserSearch("");
        const roleKey = normalizeRoleName(role.name ?? "");
        if (roleKey) {
            const ids = Object.entries(allUserRolesMap)
                .filter(([, rolesForUser]) =>
                    (rolesForUser ?? []).some((roleName) => normalizeRoleName(roleName) === roleKey)
                )
                .map(([userId]) => userId);
            setSelectedEditUserIds(ids);
        } else {
            setSelectedEditUserIds([]);
        }
        setEditRoleOpen(true);
    };

    const closeEditRoleModal = () => {
        setEditRoleOpen(false);
        resetEditRoleForm();
    };

    const handleCreateRole = async (event?: React.FormEvent) => {
        if (event) event.preventDefault();
        if (!canCreateRole) return;

        const trimmedName = roleName.trim();
        if (!trimmedName) {
            setCreateError("Role name is required.");
            return;
        }
        if (selectedPermissions.length === 0) {
            setCreateError("Select at least one permission.");
            return;
        }

        try {
            setCreatingRole(true);
            setCreateError(null);
            setCreateSuccess(null);
            const createdRole = await AuthServices.createRole({
                name: trimmedName,
                permissions: selectedPermissions,
                color: roleColor,
            });
            const createdName = createdRole?.name ?? trimmedName.toUpperCase();

            if (selectedCreateUserIds.length > 0 && canAssignRoles) {
                const existingRoles = await AuthServices.getUserRoles(selectedCreateUserIds);
                const existingByUser = new Map<string, string[]>();
                (existingRoles ?? []).forEach((entry) => {
                    existingByUser.set(entry.userId, entry.roles ?? []);
                });

                await Promise.all(
                    selectedCreateUserIds.map((userId) => {
                        const current = existingByUser.get(userId) ?? [];
                        const next = Array.from(new Set([...current, createdName]));
                        return AuthServices.setUserRoles(userId, next);
                    })
                );
                setCreateSuccess(
                    `Role ${createdName} created and added to ${selectedCreateUserIds.length} member${
                        selectedCreateUserIds.length === 1 ? "" : "s"
                    }.`
                );
                setRoleMemberRefreshKey((prev) => prev + 1);
            } else {
                setCreateSuccess(`Role ${createdName} created.`);
            }

            setRoleName("");
            setRoleColor(roleColorOptions[0] ?? "#2f6bff");
            setSelectedPermissions([]);
            setSelectedCreateUserIds([]);
            setCreateUserSearch("");
            setCreateStep("details");
            const data = await AuthServices.getRoles();
            setRoles(data ?? []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create role";
            setCreateError(message);
        } finally {
            setCreatingRole(false);
        }
    };

    const handleUpdateRole = async () => {
        if (!canEditRoles && !canManageRoleMembers) {
            setEditError("You do not have permission to update roles.");
            return;
        }
        if (!editRoleId) {
            setEditError("Role ID is missing.");
            return;
        }
        const trimmedName = editRoleName.trim();
        const normalizedNewName = normalizeRoleName(trimmedName);
        const normalizedOldName = normalizeRoleName(editRoleOriginalName || trimmedName);
        if (!trimmedName) {
            setEditError("Role name is required.");
            return;
        }
        if (canEditRoles && editPermissions.length === 0) {
            setEditError("Select at least one permission.");
            return;
        }

        try {
            setEditSaving(true);
            setEditError(null);
            setEditSuccess(null);
            if (canEditRoles) {
                await AuthServices.updateRole(editRoleId, {
                    name: trimmedName,
                    permissions: editPermissions,
                    color: editRoleColor,
                });
            }

            if (canManageRoleMembers && normalizedNewName) {
                const roleNameForAssignment = trimmedName;
                const selectedSet = new Set(selectedEditUserIds);
                const updates: Array<Promise<void>> = [];

                users.forEach((user) => {
                    const currentRoles = allUserRolesMap[user.userId] ?? [];
                    const normalizedRoles = currentRoles.map(normalizeRoleName);
                    const hasRole =
                        normalizedRoles.includes(normalizedOldName) ||
                        normalizedRoles.includes(normalizedNewName);
                    const shouldHave = selectedSet.has(user.userId);

                    if (shouldHave && !hasRole && canAssignRoles) {
                        const nextRoles = [
                            ...currentRoles.filter(
                                (roleName) =>
                                    normalizeRoleName(roleName) !== normalizedOldName &&
                                    normalizeRoleName(roleName) !== normalizedNewName
                            ),
                            roleNameForAssignment,
                        ];
                        updates.push(AuthServices.setUserRoles(user.userId, nextRoles));
                    }

                    if (!shouldHave && hasRole && canRemoveRoles) {
                        const nextRoles = currentRoles.filter(
                            (roleName) =>
                                normalizeRoleName(roleName) !== normalizedOldName &&
                                normalizeRoleName(roleName) !== normalizedNewName
                        );
                        updates.push(AuthServices.setUserRoles(user.userId, nextRoles));
                    }
                });

                if (updates.length > 0) {
                    await Promise.all(updates);
                }
            }
            setEditSuccess(canEditRoles ? "Role updated." : "Role members updated.");
            setEditRoleOriginalName(trimmedName);
            const data = await AuthServices.getRoles();
            setRoles(data ?? []);
            setRoleMemberRefreshKey((prev) => prev + 1);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update role";
            setEditError(message);
        } finally {
            setEditSaving(false);
        }
    };

    const handleDeleteRole = async () => {
        if (!canDeleteRoles) {
            setEditError("You do not have permission to delete roles.");
            return;
        }
        if (!editRoleId) {
            setEditError("Role ID is missing.");
            return;
        }
        const expected = normalizeRoleName(editRoleOriginalName || editRoleName);
        const provided = normalizeRoleName(deleteConfirmName);
        if (!expected || expected !== provided) {
            setEditError("Type the role name to confirm deletion.");
            return;
        }
        const confirmed = window.confirm(`Delete role ${editRoleOriginalName || editRoleName}? This cannot be undone.`);
        if (!confirmed) return;

        try {
            setDeletingRole(true);
            setEditError(null);
            setEditSuccess(null);
            await AuthServices.deleteRole(editRoleId);
            setEditSuccess("Role deleted.");
            const data = await AuthServices.getRoles();
            setRoles(data ?? []);
            setRoleMemberRefreshKey((prev) => prev + 1);
            closeEditRoleModal();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to delete role";
            setEditError(message);
        } finally {
            setDeletingRole(false);
        }
    };

    if (!permissionsLoading && !permissionsError && !canAccessSettings) {
        return null;
    }

    return (
        <>
            <div className="settingsSectionHeader">
                <div>
                    <h2 className="settingsSectionTitle">{tabCopy[activeTab].title}</h2>
                    <p className="settingsHelperText">{tabCopy[activeTab].helper}</p>
                </div>
                {permissionsLoading ? (
                    <div className="settingsMeta">Loading permissions...</div>
                ) : null}
            </div>

            {permissionsError ? (
                <div className="settingsError">{permissionsError}</div>
            ) : null}

            <div className="settingsSectionGrid">
                {activeTab !== "roles" ? (
                <Card
                    title={
                        activeTab === "workflow"
                            ? "Workflow settings"
                            : activeTab === "tax"
                              ? "Tax settings"
                              : "Company profile"
                    }
                    className="settingsCompanyCard"
                >
                    {companyLoading ? (
                        <div className="settingsCardBody">
                            <div className="settingsMeta">Loading company details...</div>
                        </div>
                    ) : null}
                    {companyError ? (
                        <div className="settingsCardBody">
                            <div className="settingsError">{companyError}</div>
                        </div>
                    ) : null}
                    {!companyLoading && !companyError ? (
                        <>
                            {activeTab === "details" ? (
                            <div className="profile_avatar_body settingsCompanyAvatar">
                                <div
                                    className={`profile_avatar_circle ${
                                        companyLogoUrl ? "profile_avatar_circle--image" : "profile_avatar_circle--default"
                                    }`}
                                    aria-label="Company logo"
                                >
                                    {companyLogoUrl ? (
                                        <img
                                            className="profile_avatar_img"
                                            src={companyLogoUrl}
                                            alt="Company logo"
                                        />
                                    ) : (
                                        <span className="profile_avatar_letter">{companyInitial}</span>
                                    )}
                                    {canManageCompany ? (
                                        <label className="profile_avatar_overlay">
                                            {companyLogoUrl ? "Change" : "Upload"}
                                            <input
                                                className="profile_avatar_file_input"
                                                type="file"
                                                accept="image/*"
                                                onChange={(event) =>
                                                    void handleSelectCompanyLogo(event.target.files?.[0] ?? null)
                                                }
                                                disabled={companyLogoSaving}
                                            />
                                        </label>
                                    ) : null}
                                </div>
                                <div className="profile_avatar_actions">
                                    {companyLogoUrl ? (
                                        canManageCompany ? (
                                            <button
                                                type="button"
                                                className="profile_avatar_remove_btn"
                                                onClick={() => void handleRemoveCompanyLogo()}
                                                disabled={companyLogoSaving}
                                            >
                                                {companyLogoSaving ? "Updating..." : "Remove"}
                                            </button>
                                        ) : (
                                            <div className="profile_avatar_hint">
                                                Logo managed by administrators.
                                            </div>
                                        )
                                    ) : (
                                        <div className="profile_avatar_hint">
                                            {companyLogoLoading
                                                ? "Loading..."
                                                : canManageCompany
                                                  ? "No logo uploaded yet."
                                                  : "Logo uploads require the manage company permission."}
                                        </div>
                                    )}
                                    {companyLogoError ? (
                                        <div className="profile_avatar_error">{companyLogoError}</div>
                                    ) : null}
                                </div>
                            </div>
                            ) : null}
                            <div className="settingsCardBody">
                                <form
                                    className="settingsForm"
                                    onSubmit={(event) =>
                                        void (
                                            activeTab === "workflow"
                                                ? handleSaveWorkflowSettings(event)
                                                : activeTab === "tax"
                                                  ? handleSaveTaxSettings(event)
                                                  : handleSaveCompanyDetails(event)
                                        )
                                    }
                                >
                                    {activeTab === "details" ? (
                                    <label className="settingsField">
                                        <div className="settingsLabelRow">
                                            <span className="settingsLabel">Company name</span>
                                            <span className="settingsMeta">
                                                {canManageCompany ? "Editable" : "Read only"}
                                            </span>
                                        </div>
                                        <input
                                            className="settingsInput"
                                            value={companyNameDraft}
                                            onChange={(event) => {
                                                setCompanyNameDraft(event.target.value);
                                                if (companySaveError) setCompanySaveError(null);
                                                if (companySaveSuccess) setCompanySaveSuccess(null);
                                            }}
                                            readOnly={!canManageCompany}
                                            aria-readonly={!canManageCompany}
                                        />
                                    </label>
                                    ) : null}
                                    {activeTab === "details" ? (
                                    <label className="settingsField">
                                        <div className="settingsLabelRow">
                                            <span className="settingsLabel">Company ID</span>
                                            <span className="settingsMeta">Reference only</span>
                                        </div>
                                        <input
                                            className="settingsInput"
                                            value={company?.companyId ?? ""}
                                            readOnly
                                            aria-readonly="true"
                                        />
                                    </label>
                                    ) : null}
                                    {activeTab === "workflow" ? (
                                    <label className="settingsField">
                                        <div className="settingsLabelRow">
                                            <span className="settingsLabel">Payslip timing</span>
                                            <span className="settingsMeta">
                                                Company-wide delay before logged hours become a scheduled payslip
                                            </span>
                                        </div>
                                        <input
                                            className="settingsInput"
                                            type="text"
                                            inputMode="numeric"
                                            placeholder="dd:hh:mm"
                                            value={payoutFrequencyDraft}
                                            onChange={(event) => {
                                                setPayoutFrequencyDraft(formatPayoutFrequencyDraftInput(event.target.value));
                                                if (companySaveError) setCompanySaveError(null);
                                                if (companySaveSuccess) setCompanySaveSuccess(null);
                                            }}
                                            disabled={!canManageCompany}
                                        />
                                        <div className="settingsMeta">
                                            Auto-formats as dd:hh:mm. Current cadence: {formatPayoutFrequency(payoutFrequencyMinutesDraft)}.
                                        </div>
                                    </label>
                                    ) : null}
                                    {activeTab === "workflow" ? (
                                    <label className="settingsField">
                                        <div className="settingsLabelRow">
                                            <span className="settingsLabel">Timesheet logging</span>
                                            <span className="settingsMeta">Planning hours move into timesheets</span>
                                        </div>
                                        <select
                                            className="settingsSelect"
                                            value={timesheetLoggingModeDraft}
                                            onChange={(event) => {
                                                setTimesheetLoggingModeDraft(event.target.value);
                                                if (companySaveError) setCompanySaveError(null);
                                                if (companySaveSuccess) setCompanySaveSuccess(null);
                                            }}
                                            disabled={!canManageCompany}
                                        >
                                            <option value="ADMIN_FINALIZE">Admin finalize flow</option>
                                            <option value="AUTO_ON_SHIFT_END">Automatic after shift end</option>
                                        </select>
                                    </label>
                                    ) : null}
                                    {activeTab === "workflow" ? (
                                    <label className="settingsField">
                                        <div className="settingsLabelRow">
                                            <span className="settingsLabel">Travel claim mode</span>
                                            <span className="settingsMeta">How travel reimbursement enters payroll</span>
                                        </div>
                                        <select
                                            className="settingsSelect"
                                            value={travelClaimModeDraft}
                                            onChange={(event) => {
                                                setTravelClaimModeDraft(event.target.value);
                                                if (companySaveError) setCompanySaveError(null);
                                                if (companySaveSuccess) setCompanySaveSuccess(null);
                                            }}
                                            disabled={!canManageCompany}
                                        >
                                            <option value="REQUIRES_APPROVAL">Requires admin approval</option>
                                            <option value="AUTO_APPROVE">Automatically approve</option>
                                        </select>
                                    </label>
                                    ) : null}
                                    {activeTab === "tax" ? (
                                        <>
                                            <div className="settingsNotice">
                                                This tab stores manual payroll deduction templates for Dutch wages in horeca.
                                                Suggested rows cover loonheffing, employee pension, HOP, PAWW, optional
                                                employee Zvw, and other deductions. Values stay admin-maintained and are copied
                                                into new payslips.
                                            </div>
                                            <div className="settingsTaxGroup">
                                                <div className="settingsTaxGroupHeader">
                                                    <div>
                                                        <div className="settingsLabel">Dutch tax lines</div>
                                                        <div className="settingsMeta">
                                                            Use for loonheffing and optional employee-side Zvw withholding.
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="settingsTaxList">
                                                    {dutchTaxTemplates.map((template) => {
                                                        const index = payrollTaxTemplatesDraft.indexOf(template);
                                                        return (
                                                            <div key={`${template.code}-${index}`} className="settingsTaxRow">
                                                                <div className="settingsTaxRowTop">
                                                                    <strong>{template.code || "NEW_TEMPLATE"}</strong>
                                                                    <label className="settingsTaxToggle">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={Boolean(template.active)}
                                                                            onChange={(event) =>
                                                                                updatePayrollTaxTemplate(index, {
                                                                                    active: event.target.checked,
                                                                                })}
                                                                            disabled={!canManageCompany}
                                                                        />
                                                                        <span>Active</span>
                                                                    </label>
                                                                </div>
                                                                <div className="settingsTaxGrid">
                                                                    <input
                                                                        className="settingsInput"
                                                                        placeholder="Code"
                                                                        value={template.code ?? ""}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, { code: event.target.value })}
                                                                        disabled={!canManageCompany}
                                                                    />
                                                                    <input
                                                                        className="settingsInput"
                                                                        placeholder="Label"
                                                                        value={template.label ?? ""}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, { label: event.target.value })}
                                                                        disabled={!canManageCompany}
                                                                    />
                                                                    <input
                                                                        className="settingsInput"
                                                                        placeholder="Category"
                                                                        value={template.category ?? ""}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, { category: event.target.value })}
                                                                        disabled={!canManageCompany}
                                                                    />
                                                                    <select
                                                                        className="settingsSelect"
                                                                        value={template.calculationType ?? "FIXED_AMOUNT"}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, {
                                                                                calculationType: event.target.value,
                                                                            })}
                                                                        disabled={!canManageCompany}
                                                                    >
                                                                        <option value="FIXED_AMOUNT">Fixed amount</option>
                                                                        <option value="PERCENT_OF_GROSS">Percent of gross</option>
                                                                    </select>
                                                                    <input
                                                                        className="settingsInput"
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        placeholder="Configured value"
                                                                        value={template.configuredValue ?? ""}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, {
                                                                                configuredValue: event.target.value === ""
                                                                                    ? null
                                                                                    : Number(event.target.value),
                                                                            })}
                                                                        disabled={!canManageCompany}
                                                                    />
                                                                    <input
                                                                        className="settingsInput"
                                                                        type="number"
                                                                        min="0"
                                                                        step="1"
                                                                        placeholder="Sort order"
                                                                        value={template.sortOrder ?? ""}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, {
                                                                                sortOrder: event.target.value === ""
                                                                                    ? null
                                                                                    : Number(event.target.value),
                                                                            })}
                                                                        disabled={!canManageCompany}
                                                                    />
                                                                    <select
                                                                        className="settingsSelect"
                                                                        value={template.employeeProfileTrigger ?? "ALWAYS"}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, {
                                                                                employeeProfileTrigger: event.target.value,
                                                                            })}
                                                                        disabled={!canManageCompany}
                                                                    >
                                                                        <option value="ALWAYS">Always</option>
                                                                        <option value="PENSION_PARTICIPANT">Pension participant</option>
                                                                        <option value="SPECIAL_ZVW_CONTRIBUTION">Special Zvw contribution</option>
                                                                        <option value="APPLY_LOONHEFFINGSKORTING">Apply loonheffingskorting</option>
                                                                    </select>
                                                                    <input
                                                                        className="settingsInput settingsTaxNotes"
                                                                        placeholder="Notes"
                                                                        value={template.notes ?? ""}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, { notes: event.target.value })}
                                                                        disabled={!canManageCompany}
                                                                    />
                                                                </div>
                                                                {canManageCompany ? (
                                                                    <button
                                                                        type="button"
                                                                        className="settingsUserRemove"
                                                                        onClick={() => handleRemovePayrollTaxTemplate(index)}
                                                                    >
                                                                        Remove line
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            <div className="settingsTaxGroup">
                                                <div className="settingsTaxGroupHeader">
                                                    <div>
                                                        <div className="settingsLabel">CAO and other deductions</div>
                                                        <div className="settingsMeta">
                                                            Use for Horeca CAO deductions such as pension, HOP, PAWW, or any
                                                            manual employee deduction that should flow into payslips.
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="settingsTaxList">
                                                    {caoTaxTemplates.map((template) => {
                                                        const index = payrollTaxTemplatesDraft.indexOf(template);
                                                        return (
                                                            <div key={`${template.code}-${index}`} className="settingsTaxRow">
                                                                <div className="settingsTaxRowTop">
                                                                    <strong>{template.code || "NEW_TEMPLATE"}</strong>
                                                                    <label className="settingsTaxToggle">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={Boolean(template.active)}
                                                                            onChange={(event) =>
                                                                                updatePayrollTaxTemplate(index, {
                                                                                    active: event.target.checked,
                                                                                })}
                                                                            disabled={!canManageCompany}
                                                                        />
                                                                        <span>Active</span>
                                                                    </label>
                                                                </div>
                                                                <div className="settingsTaxGrid">
                                                                    <input
                                                                        className="settingsInput"
                                                                        placeholder="Code"
                                                                        value={template.code ?? ""}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, { code: event.target.value })}
                                                                        disabled={!canManageCompany}
                                                                    />
                                                                    <input
                                                                        className="settingsInput"
                                                                        placeholder="Label"
                                                                        value={template.label ?? ""}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, { label: event.target.value })}
                                                                        disabled={!canManageCompany}
                                                                    />
                                                                    <input
                                                                        className="settingsInput"
                                                                        placeholder="Category"
                                                                        value={template.category ?? ""}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, { category: event.target.value })}
                                                                        disabled={!canManageCompany}
                                                                    />
                                                                    <select
                                                                        className="settingsSelect"
                                                                        value={template.calculationType ?? "FIXED_AMOUNT"}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, {
                                                                                calculationType: event.target.value,
                                                                            })}
                                                                        disabled={!canManageCompany}
                                                                    >
                                                                        <option value="FIXED_AMOUNT">Fixed amount</option>
                                                                        <option value="PERCENT_OF_GROSS">Percent of gross</option>
                                                                    </select>
                                                                    <input
                                                                        className="settingsInput"
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        placeholder="Configured value"
                                                                        value={template.configuredValue ?? ""}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, {
                                                                                configuredValue: event.target.value === ""
                                                                                    ? null
                                                                                    : Number(event.target.value),
                                                                            })}
                                                                        disabled={!canManageCompany}
                                                                    />
                                                                    <input
                                                                        className="settingsInput"
                                                                        type="number"
                                                                        min="0"
                                                                        step="1"
                                                                        placeholder="Sort order"
                                                                        value={template.sortOrder ?? ""}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, {
                                                                                sortOrder: event.target.value === ""
                                                                                    ? null
                                                                                    : Number(event.target.value),
                                                                            })}
                                                                        disabled={!canManageCompany}
                                                                    />
                                                                    <select
                                                                        className="settingsSelect"
                                                                        value={template.employeeProfileTrigger ?? "ALWAYS"}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, {
                                                                                employeeProfileTrigger: event.target.value,
                                                                            })}
                                                                        disabled={!canManageCompany}
                                                                    >
                                                                        <option value="ALWAYS">Always</option>
                                                                        <option value="PENSION_PARTICIPANT">Pension participant</option>
                                                                        <option value="SPECIAL_ZVW_CONTRIBUTION">Special Zvw contribution</option>
                                                                        <option value="APPLY_LOONHEFFINGSKORTING">Apply loonheffingskorting</option>
                                                                    </select>
                                                                    <input
                                                                        className="settingsInput settingsTaxNotes"
                                                                        placeholder="Notes"
                                                                        value={template.notes ?? ""}
                                                                        onChange={(event) =>
                                                                            updatePayrollTaxTemplate(index, { notes: event.target.value })}
                                                                        disabled={!canManageCompany}
                                                                    />
                                                                </div>
                                                                {canManageCompany ? (
                                                                    <button
                                                                        type="button"
                                                                        className="settingsUserRemove"
                                                                        onClick={() => handleRemovePayrollTaxTemplate(index)}
                                                                    >
                                                                        Remove line
                                                                    </button>
                                                                ) : null}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            {canManageCompany ? (
                                                <button
                                                    type="button"
                                                    className="button buttonSecondary settingsAction"
                                                    onClick={handleAddPayrollTaxTemplate}
                                                >
                                                    Add deduction line
                                                </button>
                                            ) : null}
                                        </>
                                    ) : null}
                                    {canManageCompany ? (
                                        <button
                                            type="submit"
                                            className="button settingsAction"
                                            disabled={
                                                activeTab === "workflow"
                                                    ? !companyModesDirty || companySaving
                                                    : activeTab === "tax"
                                                      ? !companyTaxTemplatesDirty || companySaving
                                                      : !companyNameDirty || !companyDraftName || companySaving
                                            }
                                        >
                                            {companySaving
                                                ? "Saving..."
                                                : activeTab === "workflow"
                                                  ? "Save workflow settings"
                                                  : activeTab === "tax"
                                                    ? "Save tax settings"
                                                    : "Save details"}
                                        </button>
                                    ) : null}
                                </form>
                                {activeTab === "workflow" ? (
                                    <div className="settingsNotice">
                                        Workflow changes apply to future company-wide payroll scheduling and approvals.
                                    </div>
                                ) : null}
                                {activeTab === "tax" ? (
                                    <div className="settingsNotice">
                                        Horeca reference: use this for Dutch payroll withholding and sector deductions.
                                        Regular employee Zvw withholding is usually off unless you have a special case.
                                    </div>
                                ) : null}
                                {companySaveError ? (
                                    <div className="settingsError">{companySaveError}</div>
                                ) : null}
                                {companySaveSuccess ? (
                                    <div className="settingsSuccess">{companySaveSuccess}</div>
                                ) : null}
                            </div>
                        </>
                    ) : null}
                </Card>
                ) : null}
                {activeTab === "roles" ? (canManageRoles ? (
                    <Card
                        title="Roles and permissions"
                        className="settingsRoleCard"
                        right={
                            canCreateRole ? (
                                <button type="button" className="button" onClick={openCreateRoleModal}>
                                    Create role
                                </button>
                            ) : null
                        }
                    >
                        <div className="settingsCardBody">
                            {rolesLoading ? <div className="settingsMeta">Loading roles...</div> : null}
                            {rolesError ? <div className="settingsError">{rolesError}</div> : null}
                            {roleMembersError ? <div className="settingsError">{roleMembersError}</div> : null}
                            {!rolesLoading && !rolesError && roles.length === 0 ? (
                                <div className="settingsMeta">No roles defined yet.</div>
                            ) : null}
                            {!rolesLoading && !rolesError && roles.length > 0 ? (
                                <div className="settingsRoleList">
                                    <div className="settingsRoleHeaderRow">
                                        <span>Role</span>
                                        <span>Members</span>
                                    </div>
                                    {sortedRoles.map((role) => {
                                        const roleKey = role.id ?? role.name;
                                        const canOpenEdit =
                                            canEditRoles || canDeleteRoles || canManageRoleMembers;
                                        const roleColorValue = role.color ?? "#9ca3af";
                                        return (
                                            canOpenEdit ? (
                                                <button
                                                    key={roleKey}
                                                    type="button"
                                                    className="settingsRoleRow settingsRoleRow--clickable"
                                                    onClick={() => openEditRoleModal(role)}
                                                >
                                                    <span className="settingsRoleInfo">
                                                        <span
                                                            className="settingsRoleDot"
                                                            style={{ backgroundColor: roleColorValue }}
                                                        />
                                                        <span className="settingsRoleName">{role.name}</span>
                                                    </span>
                                                    <span className="settingsRoleCount">
                                                        {memberCountLabel(role.name)}
                                                    </span>
                                                </button>
                                            ) : (
                                                <div key={roleKey} className="settingsRoleRow">
                                                    <span className="settingsRoleInfo">
                                                        <span
                                                            className="settingsRoleDot"
                                                            style={{ backgroundColor: roleColorValue }}
                                                        />
                                                        <span className="settingsRoleName">{role.name}</span>
                                                    </span>
                                                    <span className="settingsRoleCount">
                                                        {memberCountLabel(role.name)}
                                                    </span>
                                                </div>
                                            )
                                        );
                                    })}
                                </div>
                            ) : null}
                        </div>
                    </Card>
                ) : (
                    <Card title="Roles and permissions" className="settingsRoleCard">
                        <div className="settingsCardBody">
                            <div className="settingsNotice">
                                You do not have permission to manage roles and permissions.
                            </div>
                        </div>
                    </Card>
                )) : null}
            </div>
            <Modal
                open={editRoleOpen}
                onClose={closeEditRoleModal}
                title="Edit role"
                maxHeight={560}
                height={560}
                hideDefaultFooter
                footer={
                    showEditSaveButton ? (
                        <button
                            type="button"
                            className="roleWizardPrimary"
                            onClick={() => void handleUpdateRole()}
                            disabled={!canSubmitEdit}
                        >
                            {editSaving ? "Saving..." : "Save changes"}
                        </button>
                    ) : null
                }
            >
                <div className="roleWizard roleWizard--edit">
                    <div className="roleWizardTabs" role="tablist" aria-label="Role edit steps">
                        <button
                            type="button"
                            className={`roleWizardTab ${
                                editStep === "details" ? "roleWizardTab--active" : ""
                            }`}
                            onClick={() => setEditStep("details")}
                            role="tab"
                            aria-selected={editStep === "details"}
                            disabled={editSaving || deletingRole}
                        >
                            Details
                        </button>
                        <button
                            type="button"
                            className={`roleWizardTab ${
                                editStep === "permissions" ? "roleWizardTab--active" : ""
                            }`}
                            onClick={() => setEditStep("permissions")}
                            role="tab"
                            aria-selected={editStep === "permissions"}
                            disabled={editSaving || deletingRole}
                        >
                            Permissions
                        </button>
                        <button
                            type="button"
                            className={`roleWizardTab ${
                                editStep === "members" ? "roleWizardTab--active" : ""
                            }`}
                            onClick={() => setEditStep("members")}
                            role="tab"
                            aria-selected={editStep === "members"}
                            disabled={editSaving || deletingRole}
                        >
                            Members
                        </button>
                        <button
                            type="button"
                            className={`roleWizardTab ${
                                editStep === "danger" ? "roleWizardTab--active" : ""
                            }`}
                            onClick={() => setEditStep("danger")}
                            role="tab"
                            aria-selected={editStep === "danger"}
                            disabled={editSaving || deletingRole}
                        >
                            Delete
                        </button>
                    </div>

                    {editStep === "details" ? (
                        <div className="roleWizardPanel">
                            {!canEditRoles ? (
                                <div className="roleWizardMeta">
                                    You do not have permission to edit roles.
                                </div>
                            ) : null}
                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Role name</span>
                                <input
                                    className="modal_input"
                                    value={editRoleName}
                                    onChange={(e) => setEditRoleName(e.target.value)}
                                    placeholder="e.g. PAYROLL_MANAGER"
                                    disabled={!canEditRoles || editSaving || deletingRole}
                                />
                            </label>

                            <div className="roleWizardField">
                                <span className="roleWizardLabel">Role color</span>
                                <div className="roleColorPicker">
                                    {roleColorOptions.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={`roleColorSwatch ${
                                                editRoleColor === color ? "roleColorSwatch--active" : ""
                                            }`}
                                            style={{ backgroundColor: color }}
                                            onClick={() => setEditRoleColor(color)}
                                            aria-label={`Select ${color}`}
                                            disabled={!canEditRoles || editSaving || deletingRole}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        className="roleColorInput"
                                        value={editRoleColor}
                                        onChange={(e) => setEditRoleColor(e.target.value)}
                                        disabled={!canEditRoles || editSaving || deletingRole}
                                        aria-label="Custom color"
                                    />
                                </div>
                            </div>

                            <div className="roleColorPreview">
                                <span
                                    className="roleColorPreviewDot"
                                    style={{ backgroundColor: editRoleColor }}
                                />
                                <span className="roleColorPreviewText">
                                    {editRoleName.trim() || "Role"}
                                </span>
                            </div>
                        </div>
                    ) : null}

                    {editStep === "permissions" ? (
                        <div className="roleWizardPanel">
                            <div className="roleWizardHeaderRow">
                                <span className="roleWizardLabel">Permissions</span>
                                <span className="roleWizardMeta">
                                    {editPermissions.length} selected
                                </span>
                            </div>
                            {catalogLoading ? (
                                <div className="roleWizardMeta">Loading permission catalog...</div>
                            ) : catalogError ? (
                                <div className="roleWizardAlert roleWizardAlert--error">
                                    {catalogError}
                                </div>
                            ) : (
                                renderPermissionSections(
                                    editPermissions,
                                    handleToggleEditPermission,
                                    !canEditRoles || editSaving || deletingRole
                                )
                            )}
                        </div>
                    ) : null}

                    {editStep === "members" ? (
                        <div className="roleWizardPanel">
                            {!canManageRoleMembers ? (
                                <div className="roleWizardMeta">
                                    You do not have permission to manage role members.
                                </div>
                            ) : null}
                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Find member</span>
                                <div className="roleWizardSearchWrap">
                                    <input
                                        className="modal_input"
                                        type="search"
                                        value={editUserSearch}
                                        onChange={(e) => setEditUserSearch(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key !== "Enter") return;
                                            e.preventDefault();
                                            const match = filteredEditUsers[0];
                                            if (match) {
                                                addEditUser(match);
                                                setEditUserSearch("");
                                            }
                                        }}
                                        placeholder="Search by name or email"
                                        disabled={
                                            !canAssignRoles ||
                                            editSaving ||
                                            deletingRole ||
                                            usersLoading
                                        }
                                    />
                                    {editUserSearch.trim() && filteredEditUsers.length > 0 ? (
                                        <div
                                            className="roleWizardUserList roleWizardUserList--dropdown"
                                            role="listbox"
                                            aria-label="Search results"
                                        >
                                            {filteredEditUsers.map((user) => (
                                                <button
                                                    key={user.userId}
                                                    type="button"
                                                    className="roleWizardUserItem"
                                                    onClick={() => {
                                                        addEditUser(user);
                                                        setEditUserSearch("");
                                                    }}
                                                    disabled={editSaving || deletingRole}
                                                    role="option"
                                                >
                                                    <span className="roleWizardUserName">
                                                        {displayNameForUser(user)}
                                                    </span>
                                                    <span className="roleWizardUserEmail">{user.email}</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </label>
                            {editUserSearch.trim() && filteredEditUsers.length === 0 ? (
                                <div className="roleWizardMeta">No matches found.</div>
                            ) : null}
                            {usersLoading ? (
                                <div className="roleWizardMeta">Loading members...</div>
                            ) : usersError ? (
                                <div className="roleWizardAlert roleWizardAlert--error">{usersError}</div>
                            ) : null}
                            {selectedEditUsers.length > 0 ? (
                                <div className="roleWizardField">
                                    <div className="roleWizardHeaderRow">
                                        <span className="roleWizardLabel">Members with this role</span>
                                        <span className="roleWizardMeta">
                                            {selectedEditUsers.length} selected
                                        </span>
                                    </div>
                                    <div className="roleWizardUserList" role="listbox" aria-label="Selected members">
                                        {selectedEditUsers.map((user) => (
                                            <div
                                                key={user.userId}
                                                className="roleWizardUserItem roleWizardUserItem--selected"
                                            >
                                                <div className="roleWizardUserMeta">
                                                    <span className="roleWizardUserName">
                                                        {displayNameForUser(user)}
                                                    </span>
                                                    <span className="roleWizardUserEmail">{user.email}</span>
                                                </div>
                                                {canRemoveRoles ? (
                                                    <button
                                                        type="button"
                                                        className="roleWizardUserRemove"
                                                        onClick={() => {
                                                            setSelectedEditUserIds((prev) =>
                                                                prev.filter((id) => id !== user.userId)
                                                            );
                                                            if (editSuccess) setEditSuccess(null);
                                                        }}
                                                        disabled={editSaving || deletingRole}
                                                        aria-label={`Remove ${displayNameForUser(user)}`}
                                                    >
                                                        Remove
                                                    </button>
                                                ) : null}
                                            </div>
                                        ))}
                                    </div>
                                    {!canRemoveRoles ? (
                                        <div className="roleWizardMeta">
                                            Removing members requires the remove roles permission.
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <div className="roleWizardMeta">No members selected.</div>
                            )}
                        </div>
                    ) : null}

                    {editStep === "danger" ? (
                        <div className="roleWizardPanel">
                            <div className="roleWizardAlert roleWizardAlert--warning">
                                Deleting this role is permanent and will remove it from all members.
                            </div>
                            {!canDeleteRoles ? (
                                <div className="roleWizardMeta">
                                    You do not have permission to delete roles.
                                </div>
                            ) : null}
                            <label className="roleWizardField">
                                <span className="roleWizardLabel">
                                    Type {editRoleOriginalName || editRoleName} to confirm
                                </span>
                                <input
                                    className="modal_input"
                                    value={deleteConfirmName}
                                    onChange={(e) => {
                                        setDeleteConfirmName(e.target.value);
                                        if (editError) setEditError(null);
                                        if (editSuccess) setEditSuccess(null);
                                    }}
                                    disabled={!canDeleteRoles || deletingRole}
                                />
                            </label>
                            <button
                                type="button"
                                className="roleWizardDangerButton"
                                onClick={() => void handleDeleteRole()}
                                disabled={!canConfirmDelete || deletingRole}
                            >
                                {deletingRole ? "Deleting..." : "Delete role"}
                            </button>
                        </div>
                    ) : null}

                    {editError ? (
                        <div className="roleWizardAlert roleWizardAlert--error">{editError}</div>
                    ) : null}
                    {editSuccess ? (
                        <div className="roleWizardAlert roleWizardAlert--success">{editSuccess}</div>
                    ) : null}
                </div>
            </Modal>
            <Modal
                open={createRoleOpen}
                onClose={closeCreateRoleModal}
                title="Create role"
                maxHeight={560}
                height={560}
                hideDefaultFooter
                closeOnEscape={false}
                closeOnOverlayClick={false}
            >
                <div className="roleWizard">
                    <div className="roleWizardTabs" role="tablist" aria-label="Role setup steps">
                        <button
                            type="button"
                            className={`roleWizardTab ${
                                createStep === "details" ? "roleWizardTab--active" : ""
                            }`}
                            onClick={() => setCreateStep("details")}
                            role="tab"
                            aria-selected={createStep === "details"}
                            disabled={creatingRole}
                        >
                            Details
                        </button>
                        <button
                            type="button"
                            className={`roleWizardTab ${
                                createStep === "permissions" ? "roleWizardTab--active" : ""
                            }`}
                            onClick={() => setCreateStep("permissions")}
                            role="tab"
                            aria-selected={createStep === "permissions"}
                            disabled={creatingRole}
                        >
                            Permissions
                        </button>
                        <button
                            type="button"
                            className={`roleWizardTab ${
                                createStep === "members" ? "roleWizardTab--active" : ""
                            }`}
                            onClick={() => setCreateStep("members")}
                            role="tab"
                            aria-selected={createStep === "members"}
                            disabled={creatingRole}
                        >
                            Members
                        </button>
                    </div>

                    {createStep === "details" ? (
                        <div className="roleWizardPanel">
                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Role name</span>
                                <input
                                    className="modal_input"
                                    value={roleName}
                                    onChange={(e) => {
                                        setRoleName(e.target.value);
                                        if (createSuccess) setCreateSuccess(null);
                                    }}
                                    placeholder="e.g. PAYROLL_MANAGER"
                                    disabled={creatingRole}
                                />
                            </label>

                            <div className="roleWizardField">
                                <span className="roleWizardLabel">Role color</span>
                                <div className="roleColorPicker">
                                    {roleColorOptions.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            className={`roleColorSwatch ${
                                                roleColor === color ? "roleColorSwatch--active" : ""
                                            }`}
                                            style={{ backgroundColor: color }}
                                            onClick={() => {
                                                setRoleColor(color);
                                                if (createSuccess) setCreateSuccess(null);
                                            }}
                                            aria-label={`Select ${color}`}
                                            disabled={creatingRole}
                                        />
                                    ))}
                                    <input
                                        type="color"
                                        className="roleColorInput"
                                        value={roleColor}
                                        onChange={(e) => {
                                            setRoleColor(e.target.value);
                                            if (createSuccess) setCreateSuccess(null);
                                        }}
                                        disabled={creatingRole}
                                        aria-label="Custom color"
                                    />
                                </div>
                            </div>

                            <div className="roleColorPreview">
                                <span
                                    className="roleColorPreviewDot"
                                    style={{ backgroundColor: roleColor }}
                                />
                                <span className="roleColorPreviewText">
                                    {roleName.trim() || "New role"}
                                </span>
                            </div>
                        </div>
                    ) : null}

                    {createStep === "permissions" ? (
                        <div className="roleWizardPanel">
                            <div className="roleWizardHeaderRow">
                                <span className="roleWizardLabel">Permissions</span>
                                <span className="roleWizardMeta">
                                    {selectedPermissions.length} selected
                                </span>
                            </div>
                            {catalogLoading ? (
                                <div className="roleWizardMeta">Loading permission catalog...</div>
                            ) : catalogError ? (
                                <div className="roleWizardAlert roleWizardAlert--error">
                                    {catalogError}
                                </div>
                            ) : (
                                renderPermissionSections(
                                    selectedPermissions,
                                    handleTogglePermission,
                                    creatingRole
                                )
                            )}
                        </div>
                    ) : null}

                    {createStep === "members" ? (
                        <div className="roleWizardPanel">
                            {!canAssignRoles ? (
                                <div className="roleWizardMeta">
                                    Adding members requires the assign roles permission.
                                </div>
                            ) : null}
                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Find member</span>
                                <div className="roleWizardSearchWrap">
                                    <input
                                        className="modal_input"
                                        type="search"
                                        value={createUserSearch}
                                        onChange={(e) => setCreateUserSearch(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key !== "Enter") return;
                                            e.preventDefault();
                                            const match = filteredCreateUsers[0];
                                            if (match) {
                                                addCreateUser(match);
                                                setCreateUserSearch("");
                                            }
                                        }}
                                        placeholder="Search by name or email"
                                        disabled={!canAssignRoles || usersLoading || creatingRole}
                                    />
                                    {createUserSearch.trim() && filteredCreateUsers.length > 0 ? (
                                        <div
                                            className="roleWizardUserList roleWizardUserList--dropdown"
                                            role="listbox"
                                            aria-label="Search results"
                                        >
                                            {filteredCreateUsers.map((user) => (
                                                <button
                                                    key={user.userId}
                                                    type="button"
                                                    className="roleWizardUserItem"
                                                    onClick={() => {
                                                        addCreateUser(user);
                                                        setCreateUserSearch("");
                                                    }}
                                                    disabled={creatingRole}
                                                    role="option"
                                                >
                                                    <span className="roleWizardUserName">
                                                        {displayNameForUser(user)}
                                                    </span>
                                                    <span className="roleWizardUserEmail">{user.email}</span>
                                                </button>
                                            ))}
                                        </div>
                                    ) : null}
                                </div>
                            </label>
                            {createUserSearch.trim() && filteredCreateUsers.length === 0 ? (
                                <div className="roleWizardMeta">No matches found.</div>
                            ) : null}
                            {usersLoading ? (
                                <div className="roleWizardMeta">Loading members...</div>
                            ) : usersError ? (
                                <div className="roleWizardAlert roleWizardAlert--error">{usersError}</div>
                            ) : null}
                            {selectedCreateUsers.length > 0 ? (
                                <div className="roleWizardField">
                                    <div className="roleWizardHeaderRow">
                                        <span className="roleWizardLabel">Selected members</span>
                                        <span className="roleWizardMeta">
                                            {selectedCreateUsers.length} selected
                                        </span>
                                    </div>
                                    <div className="roleWizardUserList" role="listbox" aria-label="Selected members">
                                        {selectedCreateUsers.map((user) => (
                                            <div
                                                key={user.userId}
                                                className="roleWizardUserItem roleWizardUserItem--selected"
                                            >
                                                <div className="roleWizardUserMeta">
                                                    <span className="roleWizardUserName">
                                                        {displayNameForUser(user)}
                                                    </span>
                                                    <span className="roleWizardUserEmail">{user.email}</span>
                                                </div>
                                                <button
                                                    type="button"
                                                    className="roleWizardUserRemove"
                                                    onClick={() => {
                                                        setSelectedCreateUserIds((prev) =>
                                                            prev.filter((id) => id !== user.userId)
                                                        );
                                                        if (createSuccess) setCreateSuccess(null);
                                                    }}
                                                    disabled={!canAssignRoles || creatingRole}
                                                    aria-label={`Remove ${displayNameForUser(user)}`}
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="roleWizardMeta">No members selected.</div>
                            )}
                        </div>
                    ) : null}

                    {createError ? (
                        <div className="roleWizardAlert roleWizardAlert--error">{createError}</div>
                    ) : null}
                    {createSuccess ? (
                        <div className="roleWizardAlert roleWizardAlert--success">{createSuccess}</div>
                    ) : null}
                    <div className="roleWizardActions">
                        <button
                            type="button"
                            className="roleWizardPrimary"
                            onClick={() => void handleCreateRole()}
                            disabled={!canSubmitCreate || creatingRole}
                        >
                            {creatingRole ? "Creating..." : "Create role"}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
