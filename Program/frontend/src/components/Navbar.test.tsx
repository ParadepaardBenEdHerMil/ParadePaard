<<<<<<< HEAD
// @ts-ignore Vitest runs with Node built-ins, but the app tsconfig does not include Node types.
=======
>>>>>>> 1a40bff4851335f013f69375a51fca2f093393dc
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Navbar from "./Navbar";

let permissions: string[] = [];

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        setStatus: vi.fn(),
        permissions,
        hasPermission: (permission: string) => permissions.includes(permission),
    }),
}));

const mockedPlatformAdminContext = vi.fn<() => {
    actingCompany: { companyId: string; companyName: string } | null;
    lastScopedCompanyId?: string | null;
    isPlatformAdmin: boolean;
    startActingAsCompany: ReturnType<typeof vi.fn>;
    stopActingAsCompany: ReturnType<typeof vi.fn>;
}>(() => ({
    actingCompany: null,
    lastScopedCompanyId: null,
    isPlatformAdmin: false,
    startActingAsCompany: vi.fn(),
    stopActingAsCompany: vi.fn(),
}));

vi.mock("../context/PlatformAdminContext", () => ({
    usePlatformAdmin: () => mockedPlatformAdminContext(),
}));

describe("Navbar", () => {
    beforeEach(() => {
        permissions = [];
    });

    it("renders a top-left previous-page arrow", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>
        );

        expect(html).toContain('aria-label="Go to previous page"');
    });

    it("renders an admin message icon next to the account menu for message admins", () => {
        permissions = ["CAN_MANAGE_MESSAGES"];

        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>
        );

        expect(html).toContain('aria-label="Open shared admin inbox"');
        expect(html.indexOf('aria-label="Open shared admin inbox"')).toBeLessThan(
            html.indexOf('aria-label="Open user menu"')
        );
    });

    it("shows a mixed page-and-user search field in the navbar", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>
        );

        expect(html).toContain('aria-label="Search users and pages"');
        expect(html).toContain('placeholder="Search users and pages"');
    });

    it("styles mixed navbar search rows with a distinct result type pill and active state", () => {
        const navbarCss = readFileSync(new URL("../stylesheets/Navbar.css", import.meta.url), "utf8");

        expect(navbarCss).toContain(".nav_search_item_top");
        expect(navbarCss).toContain(".nav_search_type");
        expect(navbarCss).toContain(".nav_search_item--active");
    });

    it("uses the shared shell background and removes the top bar separators", () => {
        const navbarCss = readFileSync(new URL("../stylesheets/Navbar.css", import.meta.url), "utf8");

        expect(navbarCss).toContain("background: var(--app-shell-background, #f2f2f2);");
        expect(navbarCss).toContain("border-bottom: 0;");
        expect(navbarCss).toContain("box-shadow: none;");
    });

    it("does not show a platform banner in scoped company mode", () => {
        mockedPlatformAdminContext.mockReturnValueOnce({
            actingCompany: {
                companyId: "company-1",
                companyName: "Acme Events",
            },
            lastScopedCompanyId: "company-1",
            isPlatformAdmin: true,
            startActingAsCompany: vi.fn(),
            stopActingAsCompany: vi.fn(),
        });

        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>
        );

        expect(html).not.toContain("Platform admin mode");
        expect(html).not.toContain("Acting in Acme Events");
        expect(html).not.toContain("Exit company");
    });
});
