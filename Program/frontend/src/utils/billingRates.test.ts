import { describe, expect, it } from "vitest";
import {
    billingRateScopeLabel,
    billingRateSectionCountLabel,
    type BillingRateSectionCount,
} from "./billingRates";

describe("billingRates utilities", () => {
    it("formats section count labels for singular and plural rows", () => {
        const empty: BillingRateSectionCount = { visible: 0, total: 0, emptyLabel: "No rates" };
        const one: BillingRateSectionCount = { visible: 1, total: 1, emptyLabel: "No rates" };
        const filtered: BillingRateSectionCount = { visible: 2, total: 5, emptyLabel: "No rates" };

        expect(billingRateSectionCountLabel(empty)).toBe("No rates");
        expect(billingRateSectionCountLabel(one)).toBe("1 rate");
        expect(billingRateSectionCountLabel(filtered)).toBe("2 of 5 rates");
    });

    it("uses consistent labels for billing-rate scopes", () => {
        expect(billingRateScopeLabel("CLIENT_FUNCTION")).toBe("Client default");
        expect(billingRateScopeLabel("PROJECT_FUNCTION")).toBe("Project rate");
        expect(billingRateScopeLabel("CLIENT_EMPLOYEE_FUNCTION")).toBe("Client employee override");
        expect(billingRateScopeLabel("PROJECT_EMPLOYEE_FUNCTION")).toBe("Project employee override");
        expect(billingRateScopeLabel("UNKNOWN")).toBe("Billing rate");
    });
});
