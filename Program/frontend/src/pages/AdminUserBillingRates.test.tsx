import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import AdminUserBillingRates from "./AdminUserBillingRates";

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
});
