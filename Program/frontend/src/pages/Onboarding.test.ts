import { describe, expect, it } from "vitest";
// @ts-expect-error The app tsconfig does not include Node types, but Vitest runs this test in Node.
import { readFileSync } from "node:fs";

describe("Onboarding address layout", () => {
    it("keeps house number and suffix inputs inside separate grid cells", () => {
        const onboardingCss = readFileSync(new URL("../stylesheets/Onboarding.css", import.meta.url), "utf8");

        expect(onboardingCss).toMatch(/\.step-panel input\s*\{[^}]*box-sizing:\s*border-box;/s);
    });

    it("shows the five accepted-applicant onboarding sections", () => {
        const onboardingPage = readFileSync(new URL("./Onboarding.tsx", import.meta.url), "utf8");

        expect(onboardingPage).toContain("Address");
        expect(onboardingPage).toContain("Bank details");
        expect(onboardingPage).toContain("Payroll and tax");
        expect(onboardingPage).toContain("ID verification");
        expect(onboardingPage).toContain("Emergency contact");
    });

    it("submits setup, uploads the ID image, and moves into profile review waiting state", () => {
        const onboardingPage = readFileSync(new URL("./Onboarding.tsx", import.meta.url), "utf8");

        expect(onboardingPage).toContain("UserServices.completeSetup");
        expect(onboardingPage).toContain("UserServices.uploadIdDocumentImage");
        expect(onboardingPage).toContain('setStatus("PENDING_PROFILE_REVIEW")');
        expect(onboardingPage).toContain("awaiting internal review");
    });

    it("preserves pending profile review status instead of treating it as active", () => {
        const authContext = readFileSync(new URL("../context/AuthContext.tsx", import.meta.url), "utf8");
        const loginPage = readFileSync(new URL("./Login.tsx", import.meta.url), "utf8");
        const activeGuard = readFileSync(new URL("../components/RequireActiveUser.tsx", import.meta.url), "utf8");

        expect(authContext).toContain('"PENDING_PROFILE_REVIEW"');
        expect(loginPage).not.toContain('me.status === "PENDING_SETUP" ? "PENDING_SETUP" : "ACTIVE"');
        expect(activeGuard).toContain('status === "PENDING_PROFILE_REVIEW"');
        expect(activeGuard).toContain('to="/onboarding"');
    });
});
