import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import { GetMinimumWage } from "./GetContracts";

vi.mock("axios", () => ({
    default: {
        get: vi.fn(),
        isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean }).isAxiosError),
    },
}));

describe("GetMinimumWage", () => {
    it("requests the contract-service minimum-wage endpoint with start date and date of birth", async () => {
        vi.mocked(axios.get).mockResolvedValue({
            data: {
                startDate: "2026-07-08",
                dateOfBirth: "2000-01-01",
                age: 26,
                minimumHourlyWage: 14.99,
                effectiveFrom: "2026-07-01",
            },
            status: 200,
        });

        const result = await GetMinimumWage("http://localhost:4004", "2026-07-08", "2000-01-01");

        expect(axios.get).toHaveBeenCalledWith(
            "http://localhost:4004/api/contract/minimum-wage",
            expect.objectContaining({
                params: { startDate: "2026-07-08", dateOfBirth: "2000-01-01" },
                withCredentials: true,
            })
        );
        expect(result.minimumHourlyWage).toBe(14.99);
        expect(result.effectiveFrom).toBe("2026-07-01");
    });
});
