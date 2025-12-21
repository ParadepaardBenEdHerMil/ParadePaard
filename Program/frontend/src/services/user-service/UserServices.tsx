import GetUsers from "./Get-Users.tsx";
import GetMe from "./Get-Me.tsx";
import type { UserResponseDTO } from "./Get-Users.tsx"; // Re-exporting the type

const API_BASE_URL = "http://localhost:4004";

export type { UserResponseDTO };

export const UserServices = {
    getUsers: async () => {
        return await GetUsers(API_BASE_URL);
    },
    getMe: async () => {
        return await GetMe(API_BASE_URL);
    }
};