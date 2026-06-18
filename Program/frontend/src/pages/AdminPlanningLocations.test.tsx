import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AdminPlanningLocations, {
    LocationClientPriorityChecklist,
    LocationDeleteConfirmation,
} from "./AdminPlanningLocations";

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
