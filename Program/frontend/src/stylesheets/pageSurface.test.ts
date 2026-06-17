// @ts-ignore Vitest runs with Node built-ins, but the app tsconfig does not include Node types.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function stylesheetText(relativePath: string): string {
    return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("shared page surface styling", () => {
    it("uses the same shared background token for shell chrome and authenticated page roots", () => {
        const pageShellCss = stylesheetText("./PageShell.css");
        const primaryNavCss = stylesheetText("./PrimaryNav.css");
        const adminDashboardCss = stylesheetText("./AdminDashboard.css");
        const managementCss = stylesheetText("./Management.css");
        const adminAuditLogCss = stylesheetText("./AdminAuditLog.css");
        const messagesCss = stylesheetText("./Messages.css");
        const payrollFinanceCss = stylesheetText("./PayrollFinance.css");
        const horecaRulesCss = stylesheetText("./HorecaPayrollRules.css");
        const profileCss = stylesheetText("./Profile.css");

        expect(pageShellCss).toContain("--app-shell-background");
        expect(primaryNavCss).toContain("var(--app-shell-background");
        expect(adminDashboardCss).toContain("var(--app-shell-background");
        expect(managementCss).toContain("var(--app-shell-background");
        expect(adminAuditLogCss).toContain("var(--app-shell-background");
        expect(messagesCss).toContain("var(--app-shell-background");
        expect(payrollFinanceCss).toContain("var(--app-shell-background");
        expect(horecaRulesCss).toContain("var(--app-shell-background");
        expect(profileCss).toContain("background: var(--app-shell-background, #f2f2f2);");
    });
});
