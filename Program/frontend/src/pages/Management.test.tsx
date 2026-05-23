import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Management from "./Management";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        permissions: ["CAN_VIEW_USERS", "CAN_ONBOARD_USERS", "CAN_MANAGE_COMPANY"],
    }),
}));

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

describe("Management", () => {
    it("does not render single-letter markers in management card headers", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Management />
            </MemoryRouter>
        );

        expect(html).not.toContain("managementCardAccent");
    });

    it("renders each management card as a clickable link without a separate Open button", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Management />
            </MemoryRouter>
        );

        expect(html).toContain("managementCardLink");
        expect(html).not.toContain("managementCardAction");
        expect(html).not.toContain(">Open</a>");
    });

    it("renders the horeca payroll and contract rules card for company managers", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Management />
            </MemoryRouter>
        );

        expect(html).toContain("Horeca Payroll and Contract Rules");
        expect(html).toContain("/management/horeca-payroll-rules");
        expect(html).not.toContain("CAO Templates");
    });

    it("renders the payroll finance card for company managers", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Management />
            </MemoryRouter>
        );

        expect(html).toContain("Payroll Finance");
        expect(html).toContain("View shift billing, employer costs, client charges, and payroll margin.");
        expect(html).toContain("/management/payroll-finance");
    });
});
