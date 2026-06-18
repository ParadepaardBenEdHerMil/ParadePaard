import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import AdminPlanningClientBillingRates, {
    getBillingRateProjectOptions,
    shouldUseScrollableProjectOptions,
} from "./AdminPlanningClientBillingRates";

const planningClientCss = readFileSync(
    fileURLToPath(new URL("../stylesheets/AdminPlanningClients.css", import.meta.url)),
    "utf8"
);

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
        className?: string;
        right?: React.ReactNode;
        children?: React.ReactNode;
    }) {
        return (
            <section className={props.className}>
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
        getPlanningOverview: vi.fn(),
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

    it("marks the billing rates card so its body can receive page padding", () => {
        const html = renderToStaticMarkup(<AdminPlanningClientBillingRates />);

        expect(html).toContain("billingRatesCard");
        expect(planningClientCss).toContain(".billingRatesCard .uiCardBody");
        expect(planningClientCss).toContain("padding: 24px");
    });

    it("filters project options to the current client and search text", () => {
        const options = getBillingRateProjectOptions(
            [
                {
                    projectId: "project-1",
                    projectName: "Summer Festival",
                    startDate: "2026-07-01",
                    endDate: "2026-07-02",
                    clientCompanyId: "client-1",
                    days: [],
                },
                {
                    projectId: "project-2",
                    projectName: "Winter Gala",
                    startDate: "2026-12-10",
                    endDate: "2026-12-10",
                    clientCompanyId: "client-1",
                    days: [],
                },
                {
                    projectId: "project-3",
                    projectName: "Other Client Event",
                    startDate: "2026-08-01",
                    endDate: "2026-08-01",
                    clientCompanyId: "client-2",
                    days: [],
                },
            ],
            "client-1",
            "winter"
        );

        expect(options).toHaveLength(1);
        expect(options[0]?.projectId).toBe("project-2");
    });

    it("uses a scrollable project option list after ten client projects", () => {
        const projects = Array.from({ length: 11 }, (_, index) => ({
            projectId: `project-${index + 1}`,
            projectName: `Project ${index + 1}`,
            startDate: "2026-07-01",
            endDate: "2026-07-01",
            clientCompanyId: "client-1",
            days: [],
        }));

        expect(shouldUseScrollableProjectOptions(projects, "client-1")).toBe(true);
    });
});
