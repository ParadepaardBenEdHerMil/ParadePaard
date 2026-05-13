import { describe, expect, it } from "vitest";
import { buildManagementSections } from "./managementSections";
import type { NavItem } from "./permissionPolicy";

describe("managementSections", () => {
    it("groups allowed management cards into visible work areas and omits empty sections", () => {
        const items: NavItem[] = [
            { label: "Users", to: "/management/users", permissions: ["CAN_VIEW_USERS"] },
            { label: "Onboarding", to: "/management/onboarding", permissions: ["CAN_ONBOARD_USERS"] },
            {
                label: "Onboarding review",
                to: "/management/onboarding-review",
                permissions: ["CAN_VIEW_ONBOARDING_QUEUE"],
            },
            { label: "Contracts", to: "/management/contracts", permissions: ["CAN_VIEW_ALL_CONTRACTS"] },
            { label: "Planning", to: "/management/planning", permissions: ["CAN_MANAGE_PLANNING"] },
            { label: "Clients", to: "/management/clients", permissions: ["CAN_MANAGE_PLANNING"] },
            { label: "All payslips", to: "/payslips?scope=all", permissions: ["CAN_VIEW_ALL_PAYSLIPS"] },
        ];

        const sections = buildManagementSections(items);

        expect(sections.map((section) => section.title)).toEqual(["People", "Planning", "Payroll", "Contracts"]);
        expect(sections[0]?.items.map((item) => item.label)).toEqual(["Users", "Onboarding", "Onboarding review"]);
        expect(sections[1]?.items.map((item) => item.label)).toEqual(["Planning", "Clients"]);
        expect(sections[2]?.items.map((item) => item.label)).toEqual(["All payslips"]);
        expect(sections[3]?.items.map((item) => item.label)).toEqual(["Contracts"]);
    });

    it("keeps unrecognized management cards available under Other tools", () => {
        const sections = buildManagementSections([
            { label: "Special report", to: "/management/reports", permissions: ["CAN_SPECIAL_REPORT"] },
        ]);

        expect(sections).toHaveLength(1);
        expect(sections[0]?.title).toBe("Other tools");
        expect(sections[0]?.items[0]?.label).toBe("Special report");
    });
});
