import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import PlatformAdminOnboarding from "./PlatformAdminOnboarding";

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

describe("PlatformAdminOnboarding", () => {
    it("renders a simple company onboarding form", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <PlatformAdminOnboarding />
            </MemoryRouter>
        );

        expect(html).toContain("Company onboarding");
        expect(html).toContain("Company name");
        expect(html).toContain("Admin first names");
        expect(html).toContain("Admin suffix");
        expect(html).toContain("Create company");
        expect(html).not.toContain("Temporary password");
    });
});
