import { describe, expect, it } from "vitest";
import { userStatusCellClass, userStatusLabel, userStatusTone } from "./userStatus";

describe("userStatusLabel", () => {
    it("collapses onboarding statuses into 'Onboarding'", () => {
        expect(userStatusLabel("PENDING_SETUP")).toBe("Onboarding");
        expect(userStatusLabel("PENDING_PROFILE_REVIEW")).toBe("Onboarding");
        expect(userStatusLabel("CHANGES_REQUESTED")).toBe("Onboarding");
    });

    it("collapses contract statuses into 'Contract pending'", () => {
        expect(userStatusLabel("PENDING_CONTRACT_SIGNATURE")).toBe("Contract pending");
        expect(userStatusLabel("PENDING_CONTRACT_REVIEW")).toBe("Contract pending");
    });

    it("labels ACTIVE and REJECTED", () => {
        expect(userStatusLabel("ACTIVE")).toBe("Active");
        expect(userStatusLabel("REJECTED")).toBe("Disabled");
    });

    it("treats a re-enabled rejected account as the transient 'Enabled'", () => {
        expect(userStatusLabel("REJECTED", { disabled: false })).toBe("Enabled");
        expect(userStatusLabel("REJECTED", { disabled: true })).toBe("Disabled");
    });

    it("shows 'Disabled' whenever the account is disabled, regardless of status", () => {
        expect(userStatusLabel("ACTIVE", { disabled: true })).toBe("Disabled");
    });
});

describe("userStatusTone / cell class", () => {
    it("maps lifecycle buckets to tones", () => {
        expect(userStatusTone("ACTIVE")).toBe("ok");
        expect(userStatusTone("PENDING_SETUP")).toBe("warn");
        expect(userStatusTone("PENDING_CONTRACT_SIGNATURE")).toBe("warn");
        expect(userStatusTone("REJECTED")).toBe("bad");
        expect(userStatusTone("REJECTED", { disabled: false })).toBe("warn");
    });

    it("maps tones to AdminLists cell classes", () => {
        expect(userStatusCellClass("ACTIVE")).toBe("cellOk");
        expect(userStatusCellClass("PENDING_SETUP")).toBe("cellWarn");
        expect(userStatusCellClass("REJECTED")).toBe("cellBad");
    });
});
