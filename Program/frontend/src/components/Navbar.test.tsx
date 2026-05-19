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

    it("does not render a shared inbox button in the navbar", () => {
        permissions = ["CAN_MANAGE_MESSAGES"];

        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Navbar />
            </MemoryRouter>
        );

        expect(html).not.toContain('aria-label="Open shared admin inbox"');
    });
});
