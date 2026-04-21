import axios from "axios";
import type { UserResponseDTO, UserUpdateRequestDTO } from "./Types";

export default async function UpdateUser(
    API_BASE_URL: string,
    userId: string,
    payload: UserUpdateRequestDTO
): Promise<UserResponseDTO> {
    try {
        const res = await axios.put<UserResponseDTO>(
            `${API_BASE_URL}/api/users/${userId}`,
            payload,
            {
                headers: { "Content-Type": "application/json" },
                withCredentials: true,
            }
        );

        if (res.status !== 200) {
            throw new Error("Failed to update user with status: " + res.status);
        }

        return res.data;
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to update user");
        }
        throw err;
    }
}
