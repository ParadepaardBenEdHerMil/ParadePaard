import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import TravelClaims from "./TravelClaims";

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

vi.mock("../components/PageBack", () => ({
    default: function MockPageBack() {
        return <button type="button">Back</button>;
    },
}));

describe("TravelClaims", () => {
    it("shows only the generic Back control in the page header", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <TravelClaims />
            </MemoryRouter>
        );

        expect(html).toContain(">Back</button>");
        expect(html).not.toContain("Back to work history");
    });
});
