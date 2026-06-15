import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import CompanyManagementAction from "../components/platform/CompanyManagementAction";
import { toActingCompany } from "../utils/platformCompany";
import PlatformAdminCompanyDetails from "./PlatformAdminCompanyDetails";

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
    it("disables company management for the authenticated user's own company", () => {
        const html = renderToStaticMarkup(
            <CompanyManagementAction
                selectedCompanyId="company-1"
                currentUserCompanyId="company-1"
                onOpen={vi.fn()}
            />
        );

        expect(html).toContain('disabled=""');
        expect(html).toContain(
            'title="You are already managing this company through your current account."'
        );
    });

    it("keeps company management enabled for another company", () => {
        const html = renderToStaticMarkup(
            <CompanyManagementAction
                selectedCompanyId="company-2"
                currentUserCompanyId="company-1"
                onOpen={vi.fn()}
            />
        );

        expect(html).not.toContain('disabled=""');
        expect(html).not.toContain("You are already managing this company through your current account.");
    });

    it("keeps company management disabled while the current company is loading", () => {
        const html = renderToStaticMarkup(
            <CompanyManagementAction
                selectedCompanyId="company-1"
                currentUserCompanyId={undefined}
                onOpen={vi.fn()}
            />
        );

        expect(html).toContain('disabled=""');
        expect(html).not.toContain("You are already managing this company through your current account.");
    });

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
