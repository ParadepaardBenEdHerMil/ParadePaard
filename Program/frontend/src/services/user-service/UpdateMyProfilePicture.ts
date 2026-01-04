import axios from "axios";

export default async function UpdateMyProfilePicture(
    API_BASE_URL: string,
    file: File
): Promise<void> {
    try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await axios.put(`${API_BASE_URL}/api/users/me/profile-picture`, formData, {
            withCredentials: true,
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });

        if (response.status !== 200) {
            throw new Error("Failed to upload profile picture with status: " + response.status);
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.message || "Could not upload profile picture");
        }
        throw error;
    }
}
