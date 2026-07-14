import { describe, expect, it } from "vitest";
import {
    formatFlagLines,
    onboardingFieldMeta,
    sanitizeFieldFlags,
} from "./onboardingReviewFields";

describe("sanitizeFieldFlags", () => {
    it("keeps only known field keys with a non-empty, trimmed explanation", () => {
        const result = sanitizeFieldFlags({
            iban: "  Wrong account  ",
            city: "",
            unknownField: "should be dropped",
            idExpirationDate: "Expired document",
        });
        expect(result).toEqual({
            iban: "Wrong account",
            idExpirationDate: "Expired document",
        });
    });

    it("returns an empty object for non-objects", () => {
        expect(sanitizeFieldFlags(null)).toEqual({});
        expect(sanitizeFieldFlags(undefined)).toEqual({});
        expect(sanitizeFieldFlags("nope")).toEqual({});
    });
});

describe("formatFlagLines", () => {
    it("formats and orders flags by onboarding step", () => {
        const lines = formatFlagLines({
            emergencyContactPhone: "Add a reachable number", // step 5
            iban: "Wrong account", // step 2
            street: "Missing house number", // step 1
        });
        expect(lines).toEqual([
            "Address · Street: Missing house number",
            "Bank details · IBAN: Wrong account",
            "Emergency contact · Phone: Add a reachable number",
        ]);
    });

    it("skips empty explanations and tolerates null", () => {
        expect(formatFlagLines({ iban: "   " })).toEqual([]);
        expect(formatFlagLines(null)).toEqual([]);
    });
});

describe("onboardingFieldMeta", () => {
    it("resolves a known key to its label, section, and step", () => {
        expect(onboardingFieldMeta("idDocumentFrontImage")).toEqual({
            label: "Front ID document",
            section: "Identification",
            step: 4,
        });
    });

    it("returns null for an unknown key", () => {
        expect(onboardingFieldMeta("pensionParticipant")).toBeNull();
    });
});
