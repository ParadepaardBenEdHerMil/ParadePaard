import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import AdminPlanningClientBillingRates from "./AdminPlanningClientBillingRates";

vi.mock("react-router-dom", () => ({
    useOutletContext: () => ({
        client: {
            clientCompanyId: "client-1",
            name: "Festival Breda",
        },
    }),
}));

vi.mock("../components/common/Card", () => ({
    default: function MockCard(props: {
        title?: React.ReactNode;
        right?: React.ReactNode;
        children?: React.ReactNode;
    }) {
        return (
            <section>
                <div>{props.title}</div>
                <div>{props.right}</div>
                <div>{props.children}</div>
            </section>
        );
    },
}));

vi.mock("../components/common/Modal", () => ({
    default: function MockModal() {
        return null;
    },
}));

vi.mock("../services/user-service/UserServices", () => ({
    UserServices: {
        getClientBillingRates: vi.fn(),
        saveClientDefaultBillingRate: vi.fn(),
        saveProjectBillingRate: vi.fn(),
        saveClientEmployeeBillingRate: vi.fn(),
        saveProjectEmployeeBillingRate: vi.fn(),
    },
}));

describe("AdminPlanningClientBillingRates", () => {
    it("renders default, project, and employee billing-rate sections", () => {
        const html = renderToStaticMarkup(<AdminPlanningClientBillingRates />);

        expect(html).toContain("Billing rates");
        expect(html).toContain("Default billing rates");
        expect(html).toContain("Project billing rates");
        expect(html).toContain("Employee overrides");
    });
});
