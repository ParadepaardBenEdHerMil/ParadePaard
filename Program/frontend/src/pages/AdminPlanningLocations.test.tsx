import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AdminPlanningLocations, {
    LocationClientPriorityChecklist,
    LocationDeleteConfirmation,
} from "./AdminPlanningLocations";

const planningLocationsCss = readFileSync(
    fileURLToPath(new URL("../stylesheets/AdminPlanningLocations.css", import.meta.url)),
    "utf8"
);
const profileCss = readFileSync(
    fileURLToPath(new URL("../stylesheets/Profile.css", import.meta.url)),
    "utf8"
);

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
        return <a href="/management">Back to Management</a>;
    },
}));

describe("AdminPlanningLocations", () => {
    it("renders the planning locations page as a standard row list shell", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <AdminPlanningLocations />
            </MemoryRouter>
        );

        expect(html).toContain("Planning locations");
        expect(html).toContain("Add location");
        expect(html).toContain("Saved locations");
        expect(html).toContain("Location");
        expect(html).toContain("Address");
        expect(html).toContain("Notes");
        expect(html).toContain("Clients");
        expect(html).toContain("Actions");
        expect(html).not.toContain("planningLocationsGrid");
    });

    it("uses the same row rhythm and typography as general information", () => {
        expect(planningLocationsCss).toContain(".planningLocationsRow.clickableRow:hover");
        expect(planningLocationsCss).toContain("padding: 16px 20px");
        expect(planningLocationsCss).toContain("border-bottom: 1px solid #f0f0f0");
        expect(planningLocationsCss).toContain("background: rgba(0,0,0,0.02)");
        expect(planningLocationsCss).toContain("font-size: 14px");
        expect(planningLocationsCss).toContain("font-weight: 500");
        expect(planningLocationsCss).toContain("font-weight: 600");
        expect(planningLocationsCss).toContain("color: var(--text-main, #333)");
        expect(planningLocationsCss).toContain("color: var(--text-sub, #666)");
        expect(profileCss).toContain("padding: 16px 20px");
        expect(profileCss).toContain("border-bottom: 1px solid #f0f0f0");
        expect(profileCss).toContain("font-size: 14px");
        expect(profileCss).toContain("color: var(--text-main, #333)");
        expect(profileCss).toContain("color: var(--text-sub, #666)");
    });

    it("renders a clear in-app confirmation before deleting a location", () => {
        const html = renderToStaticMarkup(
            <LocationDeleteConfirmation
                locationName="Rotterdam Hall"
                deleting={false}
                error={null}
                onCancel={() => undefined}
                onConfirm={() => undefined}
            />
        );

        expect(html).toContain("Rotterdam Hall");
        expect(html).toContain("This action cannot be undone");
        expect(html).toContain("Cancel");
        expect(html).toContain("Delete location");
    });

    it("renders multiple selected clients as checkboxes", () => {
        const html = renderToStaticMarkup(
            <LocationClientPriorityChecklist
                clients={[
                    { clientCompanyId: "client-1", name: "Client One", contacts: [] },
                    { clientCompanyId: "client-2", name: "Client Two", contacts: [] },
                ]}
                selectedClientIds={["client-1", "client-2"]}
                disabled={false}
                onChange={() => undefined}
            />
        );

        expect(html).toContain("Client One");
        expect(html).toContain("Client Two");
        expect(html.match(/type=\"checkbox\"/g)).toHaveLength(2);
        expect(html.match(/checked=\"\"/g)).toHaveLength(2);
    });
});
