import { describe, expect, it } from "vitest";
import { EMAIL_MERGE_FIELDS, mergeFieldsFor } from "./emailMergeFields";

describe("mergeFieldsFor", () => {
    it("offers username and temporary password only for an acceptance preset", () => {
        const tokens = mergeFieldsFor("APPLICATIONS", "ACCEPT").map((field) => field.token);
        expect(tokens).toContain("{{username}}");
        expect(tokens).toContain("{{temporary_password}}");
    });

    it("does not expose credential fields for reject / request-changes application presets", () => {
        for (const category of ["REJECT", "REQUEST_CHANGES"]) {
            const tokens = mergeFieldsFor("APPLICATIONS", category).map((field) => field.token);
            expect(tokens).not.toContain("{{username}}");
            expect(tokens).not.toContain("{{temporary_password}}");
        }
    });

    it("does not expose credential fields for other groups, even an ACCEPT category", () => {
        // ACCEPT is not valid outside APPLICATIONS, but guard the selector regardless.
        expect(mergeFieldsFor("USERS", "GENERAL")).toEqual(EMAIL_MERGE_FIELDS);
        expect(mergeFieldsFor("ONBOARDING", "ACCEPT")).toEqual(EMAIL_MERGE_FIELDS);
    });
});
