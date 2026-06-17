import { describe, expect, it } from "vitest";
// @ts-ignore The app tsconfig does not include Node types, but Vitest runs this test in Node.
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
        expect(onboardingPage).toContain("Front of ID");
        expect(onboardingPage).toContain("Back of ID");
    });

    it("submits setup, uploads the ID image, and moves into profile review waiting state", () => {
        const onboardingPage = readFileSync(new URL("./Onboarding.tsx", import.meta.url), "utf8");

        expect(onboardingPage).toContain("UserServices.completeSetup");
        expect(onboardingPage).toContain("UserServices.uploadIdDocumentImages");
        expect(onboardingPage).toContain('setStatus("PENDING_PROFILE_REVIEW")');
        expect(onboardingPage).toContain("awaiting internal review");
    });

    it("uploads both ID images before completing setup so refreshes cannot strand retry", () => {
        const onboardingPage = readFileSync(new URL("./Onboarding.tsx", import.meta.url), "utf8");
        const uploadIndex = onboardingPage.indexOf("await UserServices.uploadIdDocumentImages");
        const setupIndex = onboardingPage.indexOf("await UserServices.completeSetup");

        expect(uploadIndex).toBeGreaterThan(-1);
        expect(setupIndex).toBeGreaterThan(-1);
        expect(uploadIndex).toBeLessThan(setupIndex);
        expect(onboardingPage).toContain("setStep(4)");
    });

    it("renders separate front and back file pickers for ID verification", () => {
        const onboardingPage = readFileSync(new URL("./Onboarding.tsx", import.meta.url), "utf8");

        expect(onboardingPage).toContain("Front of ID");
        expect(onboardingPage).toContain("Back of ID");
        expect(onboardingPage).toContain('accept="image/*,.pdf,application/pdf"');
        expect(onboardingPage).toContain("Choose file");
        expect(onboardingPage).not.toContain("ID document front.");
        expect(onboardingPage).not.toContain("ID document back.");
    });

    it("auto-formats ID issue and expiration dates as dd/mm/yyyy before submitting ISO dates", () => {
        const onboardingPage = readFileSync(new URL("./Onboarding.tsx", import.meta.url), "utf8");

        expect(onboardingPage).toContain("normalizeDateInput");
        expect(onboardingPage).toContain("parseDisplayDate");
        expect(onboardingPage).toContain('type="text"');
        expect(onboardingPage).toContain('placeholder="dd/mm/yyyy"');
        expect(onboardingPage).toContain('pattern="\\d{2}/\\d{2}/\\d{4}"');
        expect(onboardingPage).toContain("setIdIssueDate(normalizeDateInput(e.target.value))");
        expect(onboardingPage).toContain("setIdExpirationDate(normalizeDateInput(e.target.value))");
        expect(onboardingPage).toContain("const parsedIdIssueDate = parseDisplayDate(idIssueDate);");
        expect(onboardingPage).toContain("const parsedIdExpirationDate = parseDisplayDate(idExpirationDate);");
        expect(onboardingPage).toContain("idIssueDate: parsedIdIssueDate");
        expect(onboardingPage).toContain("idExpirationDate: parsedIdExpirationDate");
    });

    it("lays out the ID upload fields in two columns on desktop and one column on mobile", () => {
        const onboardingCss = readFileSync(new URL("../stylesheets/Onboarding.css", import.meta.url), "utf8");

        expect(onboardingCss).toContain(".onboardingDocumentUploadGrid");
        expect(onboardingCss).toContain("grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);");
        expect(onboardingCss).toContain(".onboardingFilePicker");
        expect(onboardingCss).toContain(".step-panel .onboardingFilePicker");
        expect(onboardingCss).toContain("flex-direction: column;");
        expect(onboardingCss).toContain("align-items: center;");
        expect(onboardingCss).toContain("align-self: center;");
        expect(onboardingCss).toContain("min-height: 86px;");
        expect(onboardingCss).toContain("@media (max-width: 640px)");
        expect(onboardingCss).toMatch(
            /@media \(max-width: 640px\)[\s\S]*\.onboardingDocumentUploadGrid\s*\{[\s\S]*grid-template-columns:\s*1fr;/
        );
    });

    it("scopes onboarding error styles to the onboarding card", () => {
        const onboardingCss = readFileSync(new URL("../stylesheets/Onboarding.css", import.meta.url), "utf8");

        expect(onboardingCss).toContain(".onboarding-card .error-message");
        expect(onboardingCss).not.toMatch(/^\.error-message\s*\{/m);
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

    it("lets pending profile review users open a sent contract signing link", () => {
        const activeGuard = readFileSync(new URL("../components/RequireActiveUser.tsx", import.meta.url), "utf8");

        expect(activeGuard).toContain("isContractSigningRoute");
        expect(activeGuard).toContain('location.pathname.startsWith("/contracts/")');
        expect(activeGuard).toContain('location.pathname.endsWith("/sign")');
    });

    it("shows the waiting-state management CTA and reuses management-access policy", () => {
        const onboardingPage = readFileSync(new URL("./Onboarding.tsx", import.meta.url), "utf8");
        const activeGuard = readFileSync(new URL("../components/RequireActiveUser.tsx", import.meta.url), "utf8");

        expect(onboardingPage).toContain('navigate("/management")');
        expect(onboardingPage).toContain("canAccessManagement(permissions)");
        expect(activeGuard).toContain("canAccessManagement(permissions)");
        expect(activeGuard).not.toContain("SELF_APPROVAL_PERMISSIONS");
    });
});
