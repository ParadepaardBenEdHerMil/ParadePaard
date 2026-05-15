import { describe, expect, it } from "vitest";
import { canSubmitEmployerContractSignature } from "./AdminUserDetails";

describe("AdminUserDetails contract finalization", () => {
    it("requires a loaded unfinalized contract, checked agreement, and typed manager name", () => {
        expect(canSubmitEmployerContractSignature({
            contractLoaded: false,
            alreadyFinalized: false,
            agreementChecked: true,
            typedName: "Mara Manager",
        })).toBe(false);
        expect(canSubmitEmployerContractSignature({
            contractLoaded: true,
            alreadyFinalized: true,
            agreementChecked: true,
            typedName: "Mara Manager",
        })).toBe(false);
        expect(canSubmitEmployerContractSignature({
            contractLoaded: true,
            alreadyFinalized: false,
            agreementChecked: false,
            typedName: "Mara Manager",
        })).toBe(false);
        expect(canSubmitEmployerContractSignature({
            contractLoaded: true,
            alreadyFinalized: false,
            agreementChecked: true,
            typedName: "   ",
        })).toBe(false);
        expect(canSubmitEmployerContractSignature({
            contractLoaded: true,
            alreadyFinalized: false,
            agreementChecked: true,
            typedName: "Mara Manager",
        })).toBe(true);
    });
});
