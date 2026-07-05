import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Management from "./Management";

const mockedUseAuth = vi.fn(() => ({
    permissions: ["CAN_VIEW_USERS", "CAN_ONBOARD_USERS", "CAN_MANAGE_COMPANY"],
}));

vi.mock("../context/AuthContext", () => ({
    useAuth: () => mockedUseAuth(),
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

    it("renders the audit log card for company managers", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Management />
            </MemoryRouter>
        );

        expect(html).toContain("Audit log");
        expect(html).toContain("Inspect the app-wide history of approvals");
        expect(html).toContain("/management/audit-log");
    });

    it("renders the consolidated finance card for company managers", () => {
        mockedUseAuth.mockReturnValueOnce({
            permissions: ["CAN_MANAGE_COMPANY", "CAN_VIEW_PAYROLL_FINANCE"],
        });

        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Management />
            </MemoryRouter>
        );

        expect(html).toContain("Finance");
        expect(html).toContain("Payslips, work history, travel claims, the review queue, and payroll finance");
        expect(html).toContain("/management/finance");
    });

    it("renders the locations card for planning managers", () => {
        mockedUseAuth.mockReturnValueOnce({
            permissions: ["CAN_MANAGE_PLANNING"],
        });

        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Management />
            </MemoryRouter>
        );

        expect(html).toContain("Locations");
        expect(html).toContain("/management/locations");
        expect(html).toContain("Manage reusable planning locations");
    });

    it("does not render the retired onboarding card on the management page", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Management />
            </MemoryRouter>
        );

        expect(html).not.toContain(">Onboarding<");
        expect(html).not.toContain("/management/onboarding");
    });
});
