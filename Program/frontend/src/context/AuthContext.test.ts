import { describe, expect, it } from "vitest";
import { shouldRefreshPermissionsForStatus } from "./AuthContext";

describe("shouldRefreshPermissionsForStatus", () => {
    it("keeps permission loading enabled for authenticated users who are not yet active", () => {
        expect(shouldRefreshPermissionsForStatus("PENDING_SETUP")).toBe(true);
        expect(shouldRefreshPermissionsForStatus("PENDING_PROFILE_REVIEW")).toBe(true);
        expect(shouldRefreshPermissionsForStatus("CHANGES_REQUESTED")).toBe(true);
        expect(shouldRefreshPermissionsForStatus("PENDING_CONTRACT_SIGNATURE")).toBe(true);
        expect(shouldRefreshPermissionsForStatus("PENDING_CONTRACT_REVIEW")).toBe(true);
        expect(shouldRefreshPermissionsForStatus("ACTIVE")).toBe(true);
        expect(shouldRefreshPermissionsForStatus(null)).toBe(false);
    });
});
