// @ts-ignore Vitest runs with Node built-ins, but the app tsconfig does not include Node types.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function stylesheetText(relativePath: string): string {
    return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

describe("account layout styling", () => {
    it("anchors the account rail to the navbar back-button inset while keeping the main card centered", () => {
        const settingsCss = stylesheetText("./Settings.css");

        expect(settingsCss).toContain("--account-navbar-left-padding: 28px;");
        expect(settingsCss).toContain("--account-shell-left-padding: calc(var(--sidebar-collapsed-width, 76px) + 24px);");
        expect(settingsCss).toContain(
            "--account-rail-shift: calc(var(--account-shell-left-padding) - var(--account-navbar-left-padding));"
        );
        expect(settingsCss).toContain("margin-left: calc(var(--account-rail-shift) * -1);");
        expect(settingsCss).toContain("width: min(1200px, 100%);");
        expect(settingsCss).toContain("margin: 0 auto;");
    });
});
