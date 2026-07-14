import { describe, expect, it } from "vitest";
import { shouldReloadForIdentityChange } from "./authSync";

const KEY = "authActiveUserId";

describe("shouldReloadForIdentityChange", () => {
    it("ignores changes to unrelated storage keys", () => {
        expect(shouldReloadForIdentityChange("authPermissions", "u2", "u1")).toBe(false);
        expect(shouldReloadForIdentityChange(null, "u2", "u1")).toBe(false);
    });

    it("reloads when another tab logs in as a different user", () => {
        expect(shouldReloadForIdentityChange(KEY, "u2", "u1")).toBe(true);
    });

    it("reloads when another tab logs out and clears the identity", () => {
        expect(shouldReloadForIdentityChange(KEY, null, "u1")).toBe(true);
    });

    it("does not reload a tab that has not resolved its own identity yet", () => {
        // Still cold-loading: it will read the current cookie itself, so there is
        // nothing stale to reload for.
        expect(shouldReloadForIdentityChange(KEY, "u2", null)).toBe(false);
        expect(shouldReloadForIdentityChange(KEY, null, null)).toBe(false);
    });

    it("does not reload for a no-op change to the same identity", () => {
        expect(shouldReloadForIdentityChange(KEY, "u1", "u1")).toBe(false);
    });
});
