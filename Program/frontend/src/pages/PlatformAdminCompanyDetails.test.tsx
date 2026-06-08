import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PlatformAdminCompanyDetails, { toActingCompany } from "./PlatformAdminCompanyDetails";

vi.mock("../components/Navbar", () => ({
    default: function MockNavbar() {
        return <nav aria-label="Navbar" />;
    },
}));

vi.mock("../components/PrimaryNav", () => ({
    default: function MockPrimaryNav() {
        return <nav aria-label="Primary navigation" />;
    },
}));

vi.mock("../context/PlatformAdminContext", async () => {
    const actual = await vi.importActual("../context/PlatformAdminContext");
    return {
        ...actual,
        usePlatformAdmin: () => ({
            actingCompany: null,
            isPlatformAdmin: true,
            startActingAsCompany: vi.fn(),
            stopActingAsCompany: vi.fn(),
        }),
    };
});

describe("PlatformAdminCompanyDetails", () => {
    it("renders company summary and the management entry action", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <PlatformAdminCompanyDetails
                    initialCompany={{
                        companyId: "company-1",
                        name: "Acme Events",
                        payoutFrequencyMinutes: 10080,
                        timesheetLoggingMode: "ADMIN_FINALIZE",
                        travelClaimMode: "REQUIRES_APPROVAL",
                        totalUsers: 12,
                        activeUsers: 9,
                        pendingOnboardingReview: 2,
                    }}
                />
            </MemoryRouter>
        );

        expect(html).toContain("Acme Events");
        expect(html).toContain("Open company management");
        expect(html).not.toContain("Go to management");
        expect(html).toContain("Pending onboarding review");
    });

    it("maps company detail data to an acting-company payload", () => {
        expect(
            toActingCompany({
                companyId: "company-1",
                name: "Acme Events",
                payoutFrequencyMinutes: 10080,
                timesheetLoggingMode: "ADMIN_FINALIZE",
                travelClaimMode: "REQUIRES_APPROVAL",
                totalUsers: 12,
                activeUsers: 9,
                pendingOnboardingReview: 2,
            })
        ).toEqual({
            companyId: "company-1",
            companyName: "Acme Events",
        });
    });
});
