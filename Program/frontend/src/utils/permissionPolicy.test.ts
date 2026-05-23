import { describe, expect, it } from "vitest";
import {
    canAccessCompanySettings,
    canAccessManagement,
    canViewPayslips,
    getManagementNavItems,
    hasAnyPermission,
    hasPermission,
} from "./permissionPolicy";

describe("permissionPolicy", () => {
    it("checks exact and any-of permission matches", () => {
        const permissions = ["CAN_VIEW_USERS", "CAN_MANAGE_PLANNING"];

        expect(hasPermission(permissions, "CAN_VIEW_USERS")).toBe(true);
        expect(hasPermission(permissions, "CAN_MANAGE_PAYSLIPS")).toBe(false);
        expect(hasAnyPermission(permissions, ["CAN_MANAGE_PAYSLIPS", "CAN_MANAGE_PLANNING"])).toBe(true);
        expect(hasAnyPermission(permissions, ["CAN_MANAGE_PAYSLIPS", "CAN_REVIEW_PAYSLIPS"])).toBe(false);
    });

    it("treats management access as any management permission", () => {
        expect(canAccessManagement([])).toBe(false);
        expect(canAccessManagement(["CAN_VIEW_PAYSLIPS"])).toBe(false);
        expect(canAccessManagement(["CAN_MANAGE_PLANNING"])).toBe(true);
        expect(canAccessManagement(["CAN_REVIEW_PAYSLIPS"])).toBe(true);
    });

    it("keeps company settings behind company or role-management permissions", () => {
        expect(canAccessCompanySettings(["CAN_VIEW_PAYSLIPS"])).toBe(false);
        expect(canAccessCompanySettings(["CAN_MANAGE_COMPANY"])).toBe(true);
        expect(canAccessCompanySettings(["CAN_ASSIGN_ROLES"])).toBe(true);
        expect(canAccessCompanySettings(["CAN_REMOVE_ROLES"])).toBe(true);
    });

    it("shows payslips when the user can view own or all payslips", () => {
        expect(canViewPayslips([])).toBe(false);
        expect(canViewPayslips(["CAN_VIEW_PAYSLIPS"])).toBe(true);
        expect(canViewPayslips(["CAN_VIEW_ALL_PAYSLIPS"])).toBe(true);
    });

    it("builds management navigation from only allowed permissions", () => {
        const plannerItems = getManagementNavItems(["CAN_MANAGE_PLANNING"]).map((item) => item.label);
        expect(plannerItems).toEqual(["Planning", "Clients"]);

        const payrollItems = getManagementNavItems(["CAN_VIEW_ALL_PAYSLIPS", "CAN_REVIEW_PAYSLIPS"]).map(
            (item) => item.label
        );
        expect(payrollItems).toEqual(["All payslips", "Payslip review"]);
    });

    it("links review and contract management cards to their own workspaces", () => {
        expect(getManagementNavItems(["CAN_VIEW_ONBOARDING_QUEUE"])).toContainEqual(
            expect.objectContaining({
                label: "Onboarding review",
                to: "/management/onboarding-review",
            })
        );
        expect(getManagementNavItems(["CAN_VIEW_ALL_CONTRACTS"])).toContainEqual(
            expect.objectContaining({
                label: "Contracts",
                to: "/management/contracts",
            })
        );
    });

    it("treats contract review permissions as management access", () => {
        expect(canAccessManagement(["CAN_VIEW_ONBOARDING_QUEUE"])).toBe(true);
        expect(canAccessManagement(["CAN_REVIEW_ONBOARDING"])).toBe(true);
        expect(canAccessManagement(["CAN_VIEW_ALL_CONTRACTS"])).toBe(true);
        expect(canAccessManagement(["CAN_REVIEW_CONTRACTS"])).toBe(true);
        expect(canAccessManagement(["CAN_FINALIZE_CONTRACT"])).toBe(true);
    });

    it("treats application permissions as management access", () => {
        expect(canAccessManagement(["CAN_VIEW_APPLICATIONS"])).toBe(true);
        expect(canAccessManagement(["CAN_REVIEW_APPLICATIONS"])).toBe(true);
    });

    it("adds Applications to management nav for application viewers", () => {
        const items = getManagementNavItems(["CAN_VIEW_APPLICATIONS"]);
        expect(items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ label: "Applications", to: "/management/applications" }),
            ])
        );

        const reviewItems = getManagementNavItems(["CAN_REVIEW_APPLICATIONS"]);
        expect(reviewItems).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ label: "Applications", to: "/management/applications" }),
            ])
        );
    });

    it("keeps company managers on horeca rules and company settings without CAO templates", () => {
        const items = getManagementNavItems(["CAN_MANAGE_COMPANY"]).map((item) => item.label);

        expect(items).toContain("Company settings");
        expect(items).toContain("Horeca Payroll and Contract Rules");
        expect(items).not.toContain("CAO templates");
    });

    it("keeps own-contract permissions out of management access", () => {
        expect(canAccessManagement(["CAN_VIEW_OWN_CONTRACTS"])).toBe(false);
        expect(canAccessManagement(["CAN_SIGN_OWN_CONTRACTS"])).toBe(false);
    });
});
