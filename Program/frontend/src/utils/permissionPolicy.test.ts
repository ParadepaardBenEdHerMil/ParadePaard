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

    it("treats contract review permissions as management access", () => {
        expect(canAccessManagement(["CAN_VIEW_ONBOARDING_QUEUE"])).toBe(true);
        expect(canAccessManagement(["CAN_REVIEW_ONBOARDING"])).toBe(true);
        expect(canAccessManagement(["CAN_VIEW_ALL_CONTRACTS"])).toBe(true);
        expect(canAccessManagement(["CAN_REVIEW_CONTRACTS"])).toBe(true);
        expect(canAccessManagement(["CAN_FINALIZE_CONTRACT"])).toBe(true);
    });

    it("keeps own-contract permissions out of management access", () => {
        expect(canAccessManagement(["CAN_VIEW_OWN_CONTRACTS"])).toBe(false);
        expect(canAccessManagement(["CAN_SIGN_OWN_CONTRACTS"])).toBe(false);
    });
});
