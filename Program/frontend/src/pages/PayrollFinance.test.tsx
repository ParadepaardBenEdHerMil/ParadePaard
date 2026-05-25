import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PayrollFinance from "./PayrollFinance";

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

describe("PayrollFinance", () => {
    it("renders only the finance overview and employee-hidden notice", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <PayrollFinance />
            </MemoryRouter>
        );

        expect(html).toContain("Finance overview");
        expect(html).not.toContain("Approved payroll runs");
        expect(html).not.toContain("Revenue summary");
        expect(html).not.toContain("Payroll obligations");
        expect(html).not.toContain("Tax and contribution obligations");
        expect(html).not.toContain("Margin summary");
        expect(html).not.toContain("Margin calculation");
        expect(html).not.toContain("Adjustment audit log");
        expect(html).not.toContain("Finance settings");
        expect(html).not.toContain("Shift billing rates");
        expect(html).not.toContain("Finance history per shift");
        expect(html).toContain("Client billing rates and payroll margin are internal business values.");
        expect(html).toContain("not visible to employees");
    });

    it("starts from a clean slate without hard-coded approved payroll revenue", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <PayrollFinance />
            </MemoryRouter>
        );

        expect(html).toContain("Total client revenue");
        expect(html).toContain("€\u00a00,00");
        expect(html).toContain("Total employer costs");
        expect(html).toContain("Total payable to Belastingdienst");
        expect(html).toContain("Number of shifts missing billing rates");
        expect(html).toContain("No approved payroll finance records are available yet.");
        expect(html).not.toContain("€\u00a0573,00");
        expect(html).not.toContain("January 2026 horeca payroll");
        expect(html).not.toContain("Ava Jansen");
        expect(html).not.toContain("Noah Bakker");
        expect(html).not.toContain("Sara Vermeer");
        expect(html).not.toContain("Lina Smit");
        expect(html).not.toContain("Approved after payroll run");
        expect(html).not.toContain("Finance values locked");
        expect(html).not.toContain("Open run breakdown");
        expect(html).not.toContain("Bulk update billing rates");
    });
});
