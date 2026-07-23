import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import {
    CreateFunction,
    UpdateFunction,
    DeleteFunction,
    GetPublicJobFunctions,
} from "./ManageFunctions";

vi.mock("axios", () => ({
    default: {
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        get: vi.fn(),
        isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean }).isAxiosError),
    },
}));

describe("ManageFunctions service", () => {
    it("creates a function against the authenticated contract endpoint", async () => {
        vi.mocked(axios.post).mockResolvedValue({ data: { functionId: "f1", functionName: "Bar staff" } });

        const result = await CreateFunction("http://api", {
            functionName: "Bar staff",
            department: "Operations",
            hourlyWage: 20,
            active: true,
        });

        expect(axios.post).toHaveBeenCalledWith(
            "http://api/api/contract/function",
            expect.objectContaining({ functionName: "Bar staff" }),
            expect.objectContaining({ withCredentials: true })
        );
        expect(result.functionName).toBe("Bar staff");
    });

    it("updates a function by id", async () => {
        vi.mocked(axios.put).mockResolvedValue({ data: { functionId: "f1", functionName: "Runner" } });

        await UpdateFunction("http://api", "f1", { functionName: "Runner" });

        expect(axios.put).toHaveBeenCalledWith(
            "http://api/api/contract/function/f1",
            expect.objectContaining({ functionName: "Runner" }),
            expect.objectContaining({ withCredentials: true })
        );
    });

    it("deletes a function by id", async () => {
        vi.mocked(axios.delete).mockResolvedValue({ status: 204 });

        await DeleteFunction("http://api", "f1");

        expect(axios.delete).toHaveBeenCalledWith(
            "http://api/api/contract/function/f1",
            expect.objectContaining({ withCredentials: true })
        );
    });

    it("reads the public job functions from the anonymous endpoint without credentials", async () => {
        vi.mocked(axios.get).mockResolvedValue({ data: [{ functionId: "f1", functionName: "Bar staff" }] });

        const result = await GetPublicJobFunctions("http://api");

        expect(axios.get).toHaveBeenCalledWith("http://api/api/public/functions");
        expect(result).toEqual([{ functionId: "f1", functionName: "Bar staff" }]);
    });

    it("surfaces a friendly error when the request fails", async () => {
        vi.mocked(axios.post).mockRejectedValue({
            isAxiosError: true,
            response: { status: 400, data: { message: "Name is required" } },
        });

        await expect(CreateFunction("http://api", { functionName: "" })).rejects.toThrow("Name is required");
    });
});
