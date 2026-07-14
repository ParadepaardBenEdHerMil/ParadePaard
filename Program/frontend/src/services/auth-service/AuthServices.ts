import Login from "./Login";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";
import GetPermissions from "./GetPermissions";
import GetAllPermissions from "./GetAllPermissions";
import GetRoles from "./GetRoles";
import CreateRole from "./CreateRole";
import UpdateRole from "./UpdateRole";
import DeleteRole from "./DeleteRole";
import SetUserRoles from "./SetUserRoles";
import GetUserRoles from "./GetUserRoles";
import DisableUser from "./DisableUser";
import EnableUser from "./EnableUser";
import GetAccountState, { type AccountState } from "./GetAccountState";
import ResendOnboardingEmail, { type ResendOnboardingEmailResponse } from "./ResendOnboardingEmail";
import SendOnboardingChangesEmail, { type OnboardingEmailResponse } from "./SendOnboardingChangesEmail";
import SendOnboardingRejectionEmail from "./SendOnboardingRejectionEmail";
import SwitchPlatformCompanyScope, { type SwitchPlatformCompanyScopeResponse } from "./SwitchPlatformCompanyScope";
import type {
    CreateRoleRequestDTO,
    RoleResponseDTO,
    UpdateRoleRequestDTO,
    UserRolesResponseDTO,
} from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4004";

export const AuthServices = {
    login: async (username: string, password: string) => {
        return await Login(username, password, API_BASE_URL);
    },
    forgotPassword: async (email: string) => {
        return await ForgotPassword(email, API_BASE_URL);
    },
    resetPassword: async (token: string, newPassword: string) => {
        return await ResetPassword(token, newPassword, API_BASE_URL);
    },
    getPermissions: async (): Promise<string[]> => {
        return await GetPermissions(API_BASE_URL);
    },
    getAllPermissions: async (): Promise<string[]> => {
        return await GetAllPermissions(API_BASE_URL);
    },
    getRoles: async (): Promise<RoleResponseDTO[]> => {
        return await GetRoles(API_BASE_URL);
    },
    getUserRoles: async (userIds: string[]): Promise<UserRolesResponseDTO[]> => {
        return await GetUserRoles(API_BASE_URL, userIds);
    },
    createRole: async (payload: CreateRoleRequestDTO): Promise<RoleResponseDTO> => {
        return await CreateRole(API_BASE_URL, payload);
    },
    updateRole: async (roleId: string, payload: UpdateRoleRequestDTO): Promise<RoleResponseDTO> => {
        return await UpdateRole(API_BASE_URL, roleId, payload);
    },
    deleteRole: async (roleId: string): Promise<void> => {
        return await DeleteRole(API_BASE_URL, roleId);
    },
    setUserRoles: async (userId: string, roles: string[]): Promise<void> => {
        return await SetUserRoles(API_BASE_URL, userId, roles);
    },
    disableUser: async (userId: string): Promise<void> => {
        return await DisableUser(API_BASE_URL, userId);
    },
    enableUser: async (userId: string): Promise<void> => {
        return await EnableUser(API_BASE_URL, userId);
    },
    getUserAccountState: async (userId: string): Promise<AccountState> => {
        return await GetAccountState(API_BASE_URL, userId);
    },
    resendOnboardingEmail: async (userId: string): Promise<ResendOnboardingEmailResponse> => {
        return await ResendOnboardingEmail(API_BASE_URL, userId);
    },
    sendOnboardingChangesEmail: async (
        userId: string,
        note: string | null,
        flags: string[]
    ): Promise<OnboardingEmailResponse> => {
        return await SendOnboardingChangesEmail(API_BASE_URL, userId, note, flags);
    },
    sendOnboardingRejectionEmail: async (
        userId: string,
        reason: string | null
    ): Promise<OnboardingEmailResponse> => {
        return await SendOnboardingRejectionEmail(API_BASE_URL, userId, reason);
    },
    switchPlatformCompanyScope: async (companyId: string | null): Promise<SwitchPlatformCompanyScopeResponse> => {
        return await SwitchPlatformCompanyScope(API_BASE_URL, companyId);
    },
};

export type {
    AccountState,
    CreateRoleRequestDTO,
    OnboardingEmailResponse,
    ResendOnboardingEmailResponse,
    RoleResponseDTO,
    SwitchPlatformCompanyScopeResponse,
    UpdateRoleRequestDTO,
    UserRolesResponseDTO,
};
