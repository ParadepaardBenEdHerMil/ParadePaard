import axios from "axios";

export default async function GetMyProfilePicture(API_BASE_URL: string): Promise<Blob | null> {
    try {
        const response = await axios.get(`${API_BASE_URL}/api/users/me/profile-picture`, {
            responseType: "blob",
            withCredentials: true,
        });

        if (response.status !== 200) {
            return null;
        }
        return response.data as Blob;
    } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 404) {
            return null;
        }
        if (axios.isAxiosError(error)) {
            throw new Error("Could not load profile picture");
        }
        throw error;
    }
}
