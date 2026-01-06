import Login from "./Login";
import IsAdmin from "./IsAdmin";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";
import GetPermissions from "./GetPermissions";
import GetAllPermissions from "./GetAllPermissions";
import GetRoles from "./GetRoles";
import CreateRole from "./CreateRole";
import SetUserRoles from "./SetUserRoles";
import type { CreateRoleRequestDTO, RoleResponseDTO } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4004";

export const AuthServices = {
    login: async (username: string, password: string) => {
        return await Login(username, password, API_BASE_URL);
    },
    isAdmin: async () => {
        return await IsAdmin(API_BASE_URL);
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
    createRole: async (payload: CreateRoleRequestDTO): Promise<RoleResponseDTO> => {
        return await CreateRole(API_BASE_URL, payload);
    },
    setUserRoles: async (userId: string, roles: string[]): Promise<void> => {
        return await SetUserRoles(API_BASE_URL, userId, roles);
    },
};

export type { CreateRoleRequestDTO, RoleResponseDTO };
