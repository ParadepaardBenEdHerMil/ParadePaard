/* src/services/user-service/Get-Users.tsx */
import axios from "axios";

export type UserResponseDTO = {
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

export default async function GetUsers(API_BASE_URL: string): Promise<UserResponseDTO[]> {
    const response = await axios.get<UserResponseDTO[]>(`${API_BASE_URL}/api/users`, {
        withCredentials: true,
    });
    return response.data;
}