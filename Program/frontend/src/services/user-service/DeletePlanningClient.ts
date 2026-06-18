import axios from "axios";

export default async function DeletePlanningClient(
    API_BASE_URL: string,
    clientCompanyId: string
): Promise<void> {
    try {
        const res = await axios.delete<void>(
            `${API_BASE_URL}/api/planning/clients/${clientCompanyId}`,
            {
                withCredentials: true,
            }
        );

        if (res.status < 200 || res.status >= 300) {
            throw new Error("Failed to delete client company with status: " + res.status);
        }
    } catch (err) {
        if (axios.isAxiosError(err)) {
            throw new Error(err.response?.data?.message || "Failed to delete client company");
        }
        throw err;
    }
}
