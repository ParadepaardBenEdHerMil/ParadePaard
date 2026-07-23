import axios from "axios";
import { describe, expect, it, vi } from "vitest";
import GetPlanningOverview from "./GetPlanningOverview";

vi.mock("axios", () => ({
    default: {
        get: vi.fn(),
        isAxiosError: (error: unknown) => Boolean((error as { isAxiosError?: boolean }).isAxiosError),
    },
}));

describe("GetPlanningOverview", () => {
    it("normalizes missing planning arrays for newly created projects", async () => {
        vi.mocked(axios.get).mockResolvedValue({
            status: 200,
            data: [
                {
                    projectId: "project-1",
                    projectName: "New project",
                    startDate: "2026-05-25",
                    endDate: "2026-05-25",
                },
                {
                    projectId: "project-2",
                    projectName: "With partial day data",
                    startDate: "2026-05-26",
                    endDate: "2026-05-26",
                    days: [
                        {
                            day: "2026-05-26",
                            shifts: [
                                {
                                    shiftId: "shift-1",
                                    startTime: "09:00",
                                    endTime: "17:00",
                                    functionName: "Bar",
                                },
                            ],
                        },
                    ],
                },
            ],
        } as never);

        const result = await GetPlanningOverview("http://localhost:4004");

        expect(result[0]?.days).toEqual([]);
        expect(result[1]?.days).toEqual([
            {
                day: "2026-05-26",
                allocations: [],
                shifts: [
                    {
                        shiftId: "shift-1",
                        startTime: "09:00",
                        endTime: "17:00",
                        functionName: "Bar",
                        allocations: [],
                        applicants: [],
                    },
                ],
            },
        ]);
    });
});
