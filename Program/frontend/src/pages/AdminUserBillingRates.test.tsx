import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AdminUserBillingRates, { getFilteredUserBillingRateRows } from "./AdminUserBillingRates";

const billingRateFilterCss = readFileSync(
    fileURLToPath(new URL("../stylesheets/common/BillingRateColumnFilter.css", import.meta.url)),
    "utf8"
);

vi.mock("../components/common/Card", () => ({
    default: function MockCard(props: {
        title?: React.ReactNode;
        className?: string;
        children?: React.ReactNode;
    }) {
        return (
            <section className={props.className}>
                <div>{props.title}</div>
                <div>{props.children}</div>
            </section>
        );
    },
}));

vi.mock("../services/user-service/UserServices", () => ({
    UserServices: {
        getUserBillingRates: vi.fn(),
    },
}));

describe("AdminUserBillingRates", () => {
    it("renders client-level and project-level override sections", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter initialEntries={["/management/users/user-1/billing-rates"]}>
                <Routes>
                    <Route path="/management/users/:userId/billing-rates" element={<AdminUserBillingRates />} />
                </Routes>
            </MemoryRouter>
        );

        expect(html).toContain("Billing rates");
        expect(html).toContain("Client-level overrides");
        expect(html).toContain("Project-level overrides");
        expect(html).toContain("billingRatesColumnFilter");
        expect(html).toContain("All clients");
        expect(html).toContain("All projects");
        expect(html).toContain("All functions");
        expect(html).toContain("All scopes");
        expect(html).toContain("Search clients");
        expect(html).toContain("Search projects");
        expect(html).toContain("Search functions");
        expect(html).toContain("Search scopes");
        expect(html).toContain("billingRatesColumnFilter--header");
        expect(html).not.toContain("billingRatesFilterRow");
        expect(billingRateFilterCss).toContain(".billingRatesColumnFilterOptions--scrollable");
        expect(billingRateFilterCss).toContain(".billingRatesColumnFilter--header");
    });

    it("uses the padded billing rates card body styling", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter initialEntries={["/management/users/user-1/billing-rates"]}>
                <Routes>
                    <Route path="/management/users/:userId/billing-rates" element={<AdminUserBillingRates />} />
                </Routes>
            </MemoryRouter>
        );

        expect(html).toContain("billingRatesCard");
    });

    it("filters user billing-rate rows by client, project, function, and scope", () => {
        const rows = [
            {
                id: "rate-1",
                scope: "CLIENT_EMPLOYEE_FUNCTION",
                clientCompanyId: "client-1",
                clientName: "Festival Client",
                functionName: "Bartender",
                ratePerHour: 25,
            },
            {
                id: "rate-2",
                scope: "PROJECT_EMPLOYEE_FUNCTION",
                clientCompanyId: "client-2",
                clientName: "Gala Client",
                projectName: "Winter Gala",
                functionName: "Runner",
                ratePerHour: 28,
            },
        ];

        expect(getFilteredUserBillingRateRows(rows, {
            clientQuery: "gala",
            projectQuery: "winter",
            functionQuery: "runner",
            scopeQuery: "project",
        })).toEqual([rows[1]]);
    });
});
