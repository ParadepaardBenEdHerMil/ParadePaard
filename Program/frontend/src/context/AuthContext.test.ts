import { describe, expect, it } from "vitest";
import { shouldClearPermissionsState, shouldRefreshPermissionsForStatus } from "./AuthContext";

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

describe("shouldClearPermissionsState", () => {
    // Regression: deep-linked management URLs (paste + Enter / reload / bookmark)
    // bounced to /dashboard. On a cold load the status effect runs on mount, well
    // before refreshStatus() resolves, with status still null. Clearing then flips
    // permissionsLoading to false before the real permissions fetch starts, so
    // RequirePermission reads empty permissions as "denied" and redirects. During
    // that window loading is still true, so we must NOT clear.
    it("does not clear during the cold-load window (status null, still loading)", () => {
        expect(shouldClearPermissionsState(null, true)).toBe(false);
    });

    it("clears only once auth has resolved to genuinely logged-out", () => {
        expect(shouldClearPermissionsState(null, false)).toBe(true);
    });

    it("never clears for a user with a known status", () => {
        expect(shouldClearPermissionsState("ACTIVE", false)).toBe(false);
        expect(shouldClearPermissionsState("ACTIVE", true)).toBe(false);
        expect(shouldClearPermissionsState("PENDING_SETUP", false)).toBe(false);
    });
});
