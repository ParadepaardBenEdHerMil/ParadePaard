import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import AdminPlanningClientBillingRates, {
    BILLING_RATE_SCOPE_LOCK_NOTE,
    createBillingRateDraftFromRow,
    getBillingRateEmployeeOptions,
    getBillingRateModalKind,
    getBillingRateProjectOptions,
    getCombinedClientBillingRateRows,
    getFilteredClientBillingRateRows,
    isUnifiedBillingRateSaveDisabled,
    shouldUseScrollableEmployeeOptions,
    shouldUseScrollableProjectOptions,
} from "./AdminPlanningClientBillingRates";

const generalInfoCss = readFileSync(
    fileURLToPath(new URL("../stylesheets/GeneralInfo.css", import.meta.url)),
    "utf8"
);
const billingRateFilterCss = readFileSync(
    fileURLToPath(new URL("../stylesheets/common/BillingRateColumnFilter.css", import.meta.url)),
    "utf8"
);
const billingRateManagementCss = readFileSync(
    fileURLToPath(new URL("../stylesheets/common/BillingRateManagement.css", import.meta.url)),
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
        getUsers: vi.fn(),
        saveClientDefaultBillingRate: vi.fn(),
        saveProjectBillingRate: vi.fn(),
        saveClientEmployeeBillingRate: vi.fn(),
        saveProjectEmployeeBillingRate: vi.fn(),
        deleteBillingRate: vi.fn(),
    },
}));

describe("AdminPlanningClientBillingRates", () => {
    it("renders one combined billing-rate table with page-level filters", () => {
        const html = renderToStaticMarkup(<AdminPlanningClientBillingRates />);

        expect(html).toContain("Billing rates");
        expect(html).toContain("Add billing rate");
        expect(html).not.toContain("Add default");
        expect(html).not.toContain("Add project rate");
        expect(html).not.toContain("Add employee override");
        expect(html.match(/class="listContainer billingRatesListContainer"/g)).toHaveLength(1);
        expect(html).not.toContain("All billing rates");
        expect(html).not.toContain("billingRatesSection");
        expect(html).toContain("Function");
        expect(html).toContain("Project");
        expect(html).toContain("Employee");
        expect(html).toContain("Rate");
        expect(html).toContain("Actions");
        expect(html).toContain("listContainer");
        expect(html).toContain("listHeaderGrid");
        expect(html).toContain("billingRatesGridClient");
        expect(html).toContain("Default for all projects");
        expect(html).toContain("Default for all employees");
        expect(html).toContain("billingRatesColumnFilter");
        expect(html).toContain("All functions");
        expect(html).toContain("All projects");
        expect(html).toContain("All employees");
        expect(html).toContain("Search functions");
        expect(html).toContain("Search projects");
        expect(html).toContain("Search employees");
        expect(html).toContain("billingRatesColumnFilter--header");
        expect(html).not.toContain("billingRatesFilterRow");
        expect(billingRateFilterCss).toContain(".billingRatesColumnFilterOptions--scrollable");
        expect(billingRateFilterCss).toContain(".billingRatesColumnFilter--header");
        expect(billingRateFilterCss).toContain("max-height");
        expect(billingRateManagementCss).toContain(".billingRatesActionsCell");
        expect(billingRateManagementCss).toContain(".billingRatesGridClient");
        expect(billingRateManagementCss).toContain(".billingRatesRow.clickableRow:hover");
        expect(billingRateManagementCss).not.toContain("\n.clickableRow:hover");
    });

    it("uses the same row rhythm and typography as general information", () => {
        const html = renderToStaticMarkup(<AdminPlanningClientBillingRates />);

        expect(html).toContain("billingRatesCard");
        expect(html).toContain("billingRatesClientCard");
        expect(billingRateManagementCss).toContain(".billingRatesClientCard .uiCardBody");
        expect(billingRateManagementCss).toContain(".billingRatesRowPrimary");
        expect(billingRateManagementCss).toContain(".billingRatesRowSecondary");
        expect(billingRateManagementCss).toContain(".billingRatesRowValue");
        expect(billingRateManagementCss).toContain("padding: 24px");
        expect(billingRateManagementCss).toContain("border-bottom: 1px solid rgba(0,0,0,0.06)");
        expect(billingRateManagementCss).toContain("background: rgba(0,0,0,0.02)");
        expect(billingRateManagementCss).toContain("font-size: 15px");
        expect(billingRateManagementCss).toContain("font-size: 16px");
        expect(billingRateManagementCss).toContain("font-weight: 500");
        expect(billingRateManagementCss).toContain("font-weight: 700");
        expect(generalInfoCss).toContain("border-bottom: 1px solid rgba(0,0,0,0.06)");
        expect(generalInfoCss).toContain("background: rgba(0,0,0,0.02)");
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

    it("filters employee options by search text", () => {
        const options = getBillingRateEmployeeOptions(
            [
                {
                    userId: "user-1",
                    email: "sam@example.com",
                    preferredName: "Sam",
                    firstNames: "Samuel",
                    middleNamePrefix: null,
                    lastName: "Jansen",
                    gender: null,
                    dateOfBirth: null,
                    mobileNumber: null,
                    position: null,
                    workedForUsBefore: null,
                    street: null,
                    houseNumber: null,
                    houseNumberSuffix: null,
                    postalCode: null,
                    city: null,
                    country: null,
                    iban: null,
                    status: "ACTIVE",
                },
                {
                    userId: "user-2",
                    email: "lisa@example.com",
                    preferredName: null,
                    firstNames: "Elisabeth",
                    middleNamePrefix: "de",
                    lastName: "Vries",
                    gender: null,
                    dateOfBirth: null,
                    mobileNumber: null,
                    position: null,
                    workedForUsBefore: null,
                    street: null,
                    houseNumber: null,
                    houseNumberSuffix: null,
                    postalCode: null,
                    city: null,
                    country: null,
                    iban: null,
                    status: "ACTIVE",
                },
            ],
            "vries"
        );

        expect(options).toHaveLength(1);
        expect(options[0]?.userId).toBe("user-2");
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

    it("uses a scrollable employee option list after ten employees", () => {
        const users = Array.from({ length: 11 }, (_, index) => ({
            userId: `user-${index + 1}`,
            email: `employee-${index + 1}@example.com`,
            preferredName: `Employee ${index + 1}`,
            firstNames: `Employee ${index + 1}`,
            middleNamePrefix: null,
            lastName: "Tester",
            gender: null,
            dateOfBirth: null,
            mobileNumber: null,
            position: null,
            workedForUsBefore: null,
            street: null,
            houseNumber: null,
            houseNumberSuffix: null,
            postalCode: null,
            city: null,
            country: null,
            iban: null,
            status: "ACTIVE",
        }));

        expect(shouldUseScrollableEmployeeOptions(users)).toBe(true);
    });

    it("combines all client billing-rate scopes into one row model with default labels", () => {
        const rows = getCombinedClientBillingRateRows(
            {
                defaultRates: [{
                    id: "rate-1",
                    scope: "CLIENT_FUNCTION",
                    clientCompanyId: "client-1",
                    functionName: "Bartender",
                    ratePerHour: 25,
                }],
                projectRates: [{
                    id: "rate-2",
                    scope: "PROJECT_FUNCTION",
                    clientCompanyId: "client-1",
                    projectId: "project-1",
                    projectName: "Summer Festival",
                    functionName: "Runner",
                    ratePerHour: 28,
                }],
                employeeOverrides: [{
                    id: "rate-3",
                    scope: "CLIENT_EMPLOYEE_FUNCTION",
                    clientCompanyId: "client-1",
                    userId: "user-1",
                    functionName: "Bar head",
                    ratePerHour: 30,
                }],
                projectEmployeeOverrides: [{
                    id: "rate-4",
                    scope: "PROJECT_EMPLOYEE_FUNCTION",
                    clientCompanyId: "client-1",
                    projectId: "project-1",
                    projectName: "Summer Festival",
                    userId: "user-1",
                    functionName: "Lead runner",
                    ratePerHour: 32,
                }],
            },
            [{
                userId: "user-1",
                email: "sam@example.com",
                preferredName: "Sam",
                firstNames: "Samuel",
                middleNamePrefix: null,
                lastName: "Jansen",
                gender: null,
                dateOfBirth: null,
                mobileNumber: null,
                position: null,
                workedForUsBefore: null,
                street: null,
                houseNumber: null,
                houseNumberSuffix: null,
                postalCode: null,
                city: null,
                country: null,
                iban: null,
                status: "ACTIVE",
            }]
        );

        expect(rows.map((row) => row.projectLabel)).toEqual([
            "Default for all projects",
            "Summer Festival",
            "Default for all projects",
            "Summer Festival",
        ]);
        expect(rows.map((row) => row.employeeLabel)).toEqual([
            "Default for all employees",
            "Default for all employees",
            "Sam Jansen",
            "Sam Jansen",
        ]);
    });

    it("filters combined billing-rate rows by function, project, and employee search text", () => {
        const rows = getCombinedClientBillingRateRows(
            {
                defaultRates: [],
                projectRates: [{
                id: "rate-1",
                scope: "PROJECT_FUNCTION",
                clientCompanyId: "client-1",
                projectId: "project-1",
                projectName: "Summer Festival",
                functionName: "Bartender",
                ratePerHour: 25,
            }],
                employeeOverrides: [],
                projectEmployeeOverrides: [{
                id: "rate-2",
                scope: "PROJECT_EMPLOYEE_FUNCTION",
                clientCompanyId: "client-1",
                projectId: "project-2",
                projectName: "Winter Gala",
                userId: "user-2",
                functionName: "Runner",
                ratePerHour: 28,
            }],
            },
            [{
                userId: "user-2",
                email: "lisa@example.com",
                preferredName: "Lisa",
                firstNames: "Elisabeth",
                middleNamePrefix: null,
                lastName: "Vries",
                gender: null,
                dateOfBirth: null,
                mobileNumber: null,
                position: null,
                workedForUsBefore: null,
                street: null,
                houseNumber: null,
                houseNumberSuffix: null,
                postalCode: null,
                city: null,
                country: null,
                iban: null,
                status: "ACTIVE",
            }]
        );

        expect(getFilteredClientBillingRateRows(rows, {
            functionQuery: "runner",
            projectQuery: "winter",
            employeeQuery: "lisa",
        })).toEqual([rows[1]]);
    });

    it("maps checked project and employee defaults to the correct billing-rate scope", () => {
        expect(getBillingRateModalKind({
            defaultForAllProjects: true,
            defaultForAllEmployees: true,
        })).toBe("default");
        expect(getBillingRateModalKind({
            defaultForAllProjects: false,
            defaultForAllEmployees: true,
        })).toBe("project");
        expect(getBillingRateModalKind({
            defaultForAllProjects: true,
            defaultForAllEmployees: false,
        })).toBe("employee");
        expect(getBillingRateModalKind({
            defaultForAllProjects: false,
            defaultForAllEmployees: false,
        })).toBe("projectEmployee");
    });

    it("requires project and employee selections only when their default checkboxes are off", () => {
        expect(isUnifiedBillingRateSaveDisabled({
            saving: false,
            draft: {
                functionName: "Bartender",
                ratePerHour: 25,
                projectId: "",
                userId: "",
                defaultForAllProjects: true,
                defaultForAllEmployees: true,
            },
        })).toBe(false);

        expect(isUnifiedBillingRateSaveDisabled({
            saving: false,
            draft: {
                functionName: "Bartender",
                ratePerHour: 25,
                projectId: "",
                userId: "",
                defaultForAllProjects: false,
                defaultForAllEmployees: true,
            },
        })).toBe(true);

        expect(isUnifiedBillingRateSaveDisabled({
            saving: false,
            draft: {
                functionName: "Bartender",
                ratePerHour: 25,
                projectId: "project-1",
                userId: "user-1",
                defaultForAllProjects: false,
                defaultForAllEmployees: false,
            },
        })).toBe(false);
    });

    it("prefills the unified modal draft when editing an existing billing-rate row", () => {
        expect(createBillingRateDraftFromRow({
            id: "rate-1",
            scope: "PROJECT_EMPLOYEE_FUNCTION",
            clientCompanyId: "client-1",
            projectId: "project-1",
            projectName: "Winter Gala",
            userId: "user-1",
            functionName: "Runner",
            ratePerHour: 28,
            effectiveFrom: "2026-06-21T10:00:00",
            effectiveTo: "2026-07-01T10:00:00",
            notes: "Existing note",
            projectLabel: "Winter Gala",
            employeeLabel: "Sam Jansen",
        })).toEqual({
            editingRateId: "rate-1",
            functionName: "Runner",
            ratePerHour: 28,
            projectId: "project-1",
            userId: "user-1",
            effectiveFrom: "2026-06-21T10:00:00",
            effectiveTo: "2026-07-01T10:00:00",
            notes: "Existing note",
            defaultForAllProjects: false,
            defaultForAllEmployees: false,
        });

        expect(createBillingRateDraftFromRow({
            id: "rate-2",
            scope: "CLIENT_FUNCTION",
            clientCompanyId: "client-1",
            functionName: "Bartender",
            ratePerHour: 30,
            projectLabel: "Default for all projects",
            employeeLabel: "Default for all employees",
        })).toMatchObject({
            editingRateId: "rate-2",
            functionName: "Bartender",
            ratePerHour: 30,
            projectId: "",
            userId: "",
            defaultForAllProjects: true,
            defaultForAllEmployees: true,
        });
    });

    it("explains why project and employee scope checkboxes are locked while editing", () => {
        expect(BILLING_RATE_SCOPE_LOCK_NOTE).toBe(
            "Scope is locked while editing. Add a new billing rate to use a different project or employee scope."
        );
        expect(billingRateManagementCss).toContain(".billingRatesScopeLockHelp");
        expect(billingRateManagementCss).toContain(".billingRatesScopeLockHelpText");
    });

    it("requires both project and employee selections before saving project employee override modal rates", () => {
        expect(isUnifiedBillingRateSaveDisabled({
            saving: false,
            draft: {
                functionName: "Runner",
                ratePerHour: 28,
                projectId: "project-1",
                userId: "user-1",
                defaultForAllProjects: false,
                defaultForAllEmployees: false,
            },
        })).toBe(false);
    });
});
