import { describe, expect, it } from "vitest";
import { buildPermissionSections, formatPermission } from "./permissionSections";

describe("permissionSections", () => {
    it("groups permissions into workflow sections and keeps unknown permissions in other", () => {
        const sections = buildPermissionSections([
            "CAN_VIEW_ALL_PAYSLIPS",
            "CAN_DELETE_ROLES",
            "CAN_VIEW_USERS",
            "CAN_UNKNOWN_FEATURE",
            "CAN_CREATE_ROLE",
            "CAN_ONBOARD_USERS",
        ]);

        expect(sections.map((section) => section.title)).toEqual([
            "Role access",
            "People",
            "Payslips",
            "Other",
        ]);
        expect(sections[0]?.permissions).toEqual(["CAN_CREATE_ROLE", "CAN_DELETE_ROLES"]);
        expect(sections[1]?.permissions).toEqual(["CAN_ONBOARD_USERS", "CAN_VIEW_USERS"]);
        expect(sections[2]?.permissions).toEqual(["CAN_VIEW_ALL_PAYSLIPS"]);
        expect(sections[3]?.permissions).toEqual(["CAN_UNKNOWN_FEATURE"]);
    });

    it("formats known labels and falls back to readable permission names", () => {
        expect(formatPermission("CAN_CREATE_ROLE")).toBe("Create roles");
        expect(formatPermission("CAN_ACCESS_ADMIN_DASHBOARD")).toBe("Access management dashboard");
        expect(formatPermission("CAN_EXPORT_SPECIAL_REPORT")).toBe("Export Special Report");
    });
});
