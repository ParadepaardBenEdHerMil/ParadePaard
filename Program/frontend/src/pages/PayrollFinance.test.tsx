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
    it("renders the required payroll finance sections and employee-hidden notice", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <PayrollFinance />
            </MemoryRouter>
        );

        [
            "Finance overview",
            "Shift billing rates",
            "Client invoice calculation",
            "Employee cost breakdown",
            "Employer tax and contribution breakdown",
            "Pension cost breakdown",
            "Margin calculation",
            "Finance history per shift",
            "Finance settings",
        ].forEach((sectionTitle) => {
            expect(html).toContain(sectionTitle);
        });

        expect(html).toContain("Client billing rates and payroll margin are internal business values.");
        expect(html).toContain("not visible to employees");
    });

    it("shows finance summary cards, filters, editable billing rates, and shift rows", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <PayrollFinance />
            </MemoryRouter>
        );

        expect(html).toContain("Total client revenue");
        expect(html).toContain("Total employer costs");
        expect(html).toContain("Total payable to Belastingdienst");
        expect(html).toContain("Number of shifts missing billing rates");
        expect(html).toContain("Date range");
        expect(html).toContain("Client billing rate per hour");
        expect(html).toContain("Bulk update billing rates");
        expect(html).toContain("Margin before overhead");
        expect(html).toContain("View breakdown");
    });
});
