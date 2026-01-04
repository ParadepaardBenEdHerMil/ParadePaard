import axios from "axios";

export default async function DeleteMyProfilePicture(API_BASE_URL: string): Promise<void> {
    try {
        const response = await axios.delete(`${API_BASE_URL}/api/users/me/profile-picture`, {
            withCredentials: true,
        });

        if (response.status !== 204) {
            throw new Error("Failed to delete profile picture with status: " + response.status);
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.message || "Could not remove profile picture");
        }
        throw error;
    }
}
