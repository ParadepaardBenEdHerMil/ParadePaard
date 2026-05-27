import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import HorecaPayrollRules from "./HorecaPayrollRules";

vi.mock("../components/Navbar", () => ({
    default: function MockNavbar() {
        return <nav aria-label="Navbar" />;
    },
}));

vi.mock("../components/PrimaryNav", () => ({
    default: function MockPrimaryNav() {
        return <nav aria-label="Primary navigation" />;
    },
}));

describe("HorecaPayrollRules", () => {
    it("renders the required horeca payroll rule sections", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <HorecaPayrollRules />
            </MemoryRouter>
        );

        [
            "Overview",
            "Horeca CAO source documents",
            "Job presets",
            "Contract settings",
            "Wage rules",
            "Tax and payroll rules",
            "Pension rules",
            "Example contract population",
            "Payroll calculator",
        ].forEach((sectionTitle) => {
            expect(html).toContain(sectionTitle);
        });
    });

    it("renders a job preset header action and icon-labelled row actions without the inline editor", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <HorecaPayrollRules />
            </MemoryRouter>
        );

        expect(html).toContain('aria-label="Create job preset"');
        expect(html).toContain('aria-label="Edit preset Bar employee"');
        expect(html).toContain('aria-label="Disable preset Bar employee"');
        expect(html).toContain('aria-label="Delete preset Bar employee"');
        expect(html).not.toContain("Clear form");
    });

    it("shows important values with direct source labels", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <HorecaPayrollRules />
            </MemoryRouter>
        );

        expect(html).toContain("Hourly wage");
        expect(html).toContain("Source: Loontabel per 1 januari 2026, page 1");
        expect(html).toContain("Gross hourly wage *");
        expect(html).toContain("Manual wage override reason");
        expect(html).toContain("Holiday allowance");
        expect(html).toContain("Travel allowance rate");
        expect(html).toContain("\u20ac\u00a00,23 per km");
        expect(html).toContain("Source: Horeca cao 2025 2026, page 32");
    });

    it("renders a payroll calculator form instead of a fixed example table", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <HorecaPayrollRules />
            </MemoryRouter>
        );

        expect(html).toContain("Employee date of birth");
        expect(html).toContain("Hours per week");
        expect(html).toContain("Loonheffingskorting");
        expect(html).toContain("Generate output");
        expect(html).toContain("Payroll tax withholding is estimated");
        expect(html).not.toContain("Payroll tax withheld</span>");
        expect(html).not.toContain("Employer AWf percentage");
        expect(html).not.toContain("Example payroll calculation");
    });
});
