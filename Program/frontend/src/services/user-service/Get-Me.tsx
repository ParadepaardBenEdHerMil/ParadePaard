// src/services/user/Get-Me.tsx
import axios from "axios";

export type MeResponseDTO = {
    userId: string;
    name: string;
    email: string;
    streetName: string;
    houseNumber: string;
    houseNumberSuffix: string;
    postalCode: string;
    city: string;
    country: string;
    dateOfBirth: string;
    registeredDate: string;
    bankAccountNumber: string;
    phoneNumber: string;
    leaveHours: string;
};

export default async function GetMe(API_BASE_URL: string): Promise<MeResponseDTO> {
    try {
        const response = await axios.get<MeResponseDTO>(
            `${API_BASE_URL}/api/users/me`,
            {
                headers: { "Content-Type": "application/json" },
                withCredentials: true,
            }
        );

        if (response.status !== 200) {
            throw new Error("Failed to fetch current user with status: " + response.status);
        }

        return response.data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.message || "Could not load current user");
        }
        throw error;
    }
}