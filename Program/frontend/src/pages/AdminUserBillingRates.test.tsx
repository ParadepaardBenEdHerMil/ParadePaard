import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AdminUserBillingRates, {
    createUserBillingRateDraftFromRow,
    getFilteredUserBillingRateRows,
    getUserBillingRateModalKind,
    isUserBillingRateSaveDisabled,
} from "./AdminUserBillingRates";

const billingRateFilterCss = readFileSync(
    fileURLToPath(new URL("../stylesheets/common/BillingRateColumnFilter.css", import.meta.url)),
    "utf8"
);
const billingRateManagementCss = readFileSync(
    fileURLToPath(new URL("../stylesheets/common/BillingRateManagement.css", import.meta.url)),
    "utf8"
);
const planningClientCss = readFileSync(
    fileURLToPath(new URL("../stylesheets/AdminPlanningClients.css", import.meta.url)),
    "utf8"
);
const profileCss = readFileSync(
    fileURLToPath(new URL("../stylesheets/Profile.css", import.meta.url)),
    "utf8"
);

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

vi.mock("../services/user-service/UserServices", () => ({
    UserServices: {
        getUserBillingRates: vi.fn(),
        getPlanningClients: vi.fn(),
        getPlanningOverview: vi.fn(),
        saveClientEmployeeBillingRate: vi.fn(),
        saveProjectEmployeeBillingRate: vi.fn(),
        deleteBillingRate: vi.fn(),
    },
}));

vi.mock("../components/common/Modal", () => ({
    default: function MockModal(props: { children?: React.ReactNode }) {
        return <div>{props.children}</div>;
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
        expect(html).toContain("Add billing rate");
        expect(html).toContain("Client-level overrides");
        expect(html).toContain("Project-level overrides");
        expect(html).toContain("Actions");
        expect(html).toContain("listContainer");
        expect(html).toContain("listHeaderGrid");
        expect(html).toContain("billingRatesGridUser");
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
        expect(html).toContain("billingRatesMoneyInput");
        expect(html).toContain("billingRatesMoneyPrefix");
        expect(html).toContain("€");
        expect(billingRateFilterCss).toContain(".billingRatesColumnFilterOptions--scrollable");
        expect(billingRateFilterCss).toContain(".billingRatesColumnFilter--header");
        expect(billingRateManagementCss).toContain(".billingRatesActionsCell");
        expect(billingRateManagementCss).toContain(".billingRatesGridUser");
    });

    it("uses the same row rhythm and typography as general information", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter initialEntries={["/management/users/user-1/billing-rates"]}>
                <Routes>
                    <Route path="/management/users/:userId/billing-rates" element={<AdminUserBillingRates />} />
                </Routes>
            </MemoryRouter>
        );

        expect(html).toContain("billingRatesCard");
        expect(billingRateManagementCss).toContain(".billingRatesRowPrimary");
        expect(billingRateManagementCss).toContain(".billingRatesRowSecondary");
        expect(billingRateManagementCss).toContain(".billingRatesRowValue");
        expect(billingRateManagementCss).toContain(".billingRatesRow.clickableRow:hover");
        expect(planningClientCss).toContain(".billingRatesCard .uiCardBody");
        expect(planningClientCss).toContain("padding: 0");
        expect(planningClientCss).toContain(".billingRatesLayout");
        expect(planningClientCss).toContain("gap: 0");
        expect(planningClientCss).toContain(".billingRatesSection");
        expect(planningClientCss).toContain("border: 0");
        expect(billingRateManagementCss).toContain(".billingRatesListContainer");
        expect(billingRateManagementCss).toContain("border: 0");
        expect(billingRateManagementCss).toContain("border-radius: 0");
        expect(billingRateManagementCss).toContain("padding: 16px 20px");
        expect(billingRateManagementCss).toContain("border-bottom: 1px solid #f0f0f0");
        expect(billingRateManagementCss).toContain("background: rgba(0,0,0,0.02)");
        expect(billingRateManagementCss).toContain("font-size: 14px");
        expect(billingRateManagementCss).toContain("font-weight: 500");
        expect(billingRateManagementCss).toContain("font-weight: 600");
        expect(billingRateManagementCss).toContain("color: var(--text-main, #333)");
        expect(billingRateManagementCss).toContain("color: var(--text-sub, #666)");
        expect(billingRateFilterCss).toContain("font-size: 14px");
        expect(billingRateFilterCss).toContain("font-weight: 500");
        expect(billingRateFilterCss).toContain("color: var(--text-sub, #666)");
        expect(profileCss).toContain("padding: 16px 20px");
        expect(profileCss).toContain("border-bottom: 1px solid #f0f0f0");
        expect(profileCss).toContain("font-size: 14px");
        expect(profileCss).toContain("color: var(--text-main, #333)");
        expect(profileCss).toContain("color: var(--text-sub, #666)");
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

    it("maps user billing-rate modal defaults to user override scopes", () => {
        expect(getUserBillingRateModalKind({ defaultForAllProjects: true })).toBe("employee");
        expect(getUserBillingRateModalKind({ defaultForAllProjects: false })).toBe("projectEmployee");
    });

    it("requires a client and only requires a project when the project default is off", () => {
        expect(isUserBillingRateSaveDisabled({
            saving: false,
            draft: {
                clientCompanyId: "",
                functionName: "Bartender",
                ratePerHour: 25,
                projectId: "",
                defaultForAllProjects: true,
            },
        })).toBe(true);
        expect(isUserBillingRateSaveDisabled({
            saving: false,
            draft: {
                clientCompanyId: "client-1",
                functionName: "Bartender",
                ratePerHour: 25,
                projectId: "",
                defaultForAllProjects: false,
            },
        })).toBe(true);
        expect(isUserBillingRateSaveDisabled({
            saving: false,
            draft: {
                clientCompanyId: "client-1",
                functionName: "Bartender",
                ratePerHour: 25,
                projectId: "project-1",
                defaultForAllProjects: false,
            },
        })).toBe(false);
    });

    it("prefills the user billing-rate modal draft from an existing override row", () => {
        expect(createUserBillingRateDraftFromRow({
            id: "rate-1",
            scope: "PROJECT_EMPLOYEE_FUNCTION",
            clientCompanyId: "client-1",
            clientName: "Festival Client",
            projectId: "project-1",
            projectName: "Winter Gala",
            userId: "user-1",
            functionName: "Runner",
            ratePerHour: 28,
            notes: "Existing note",
        })).toEqual({
            editingRateId: "rate-1",
            clientCompanyId: "client-1",
            functionName: "Runner",
            ratePerHour: 28,
            projectId: "project-1",
            userId: "user-1",
            effectiveFrom: "",
            effectiveTo: "",
            notes: "Existing note",
            defaultForAllProjects: false,
        });
    });
});
