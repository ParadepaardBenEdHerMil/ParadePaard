import { describe, expect, it } from "vitest";
import { getSearchableNavbarPages } from "./navbarSearchPages";

describe("navbarSearchPages", () => {
    it("returns direct pages the user can navigate to from the navbar and management nav", () => {
        const pages = getSearchableNavbarPages(["CAN_VIEW_APPLICATIONS", "CAN_MANAGE_TIMESHEETS"]).map((page) => ({
            label: page.label,
            to: page.to,
            kind: page.kind,
            section: page.section,
        }));

        expect(pages).toEqual(
            expect.arrayContaining([
                { label: "Dashboard", to: "/dashboard", kind: "page", section: "Main" },
                { label: "Applications", to: "/management/applications", kind: "page", section: "Management" },
                { label: "Travel claims", to: "/management/travel-claims", kind: "page", section: "Management" },
                { label: "Work history", to: "/my-finance/work-history", kind: "page", section: "Main" },
            ])
        );
    });

    it("does not include restricted or deep-link-only pages", () => {
        const pages = getSearchableNavbarPages(["CAN_VIEW_PAYSLIPS"]).map((page) => page.to);

        expect(pages).toContain("/payslips");
        expect(pages).not.toContain("/management/onboarding");
        expect(pages).not.toContain("/management/users/:userId");
        expect(pages).not.toContain("/work-history/:timesheetId");
    });
});
