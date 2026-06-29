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
    it("renders the payroll finance sections inside the management shell", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <PayrollFinance />
            </MemoryRouter>
        );

        expect(html).toContain("Payroll Finance");
        expect(html).toContain("Revenue &amp; margin");
        expect(html).toContain("Margin breakdown");
        expect(html).toContain("Payroll cost overview");
        expect(html).toContain("Cost breakdown");
        expect(html).toContain("Shifts");
    });

    it("uses refined filter and table containers for the finance workspace", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <PayrollFinance />
            </MemoryRouter>
        );

        expect(html).toContain("financeFilters financeFilterPanel");
        expect(html).toContain("financeFilterField");
        expect(html).toContain("financeCardHeaderRow");
        expect(html).toContain("financeTableFrame");
        expect(html).toContain("financeExportBtn");
    });
});
