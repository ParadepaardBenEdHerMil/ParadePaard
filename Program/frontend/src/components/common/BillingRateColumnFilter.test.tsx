import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import BillingRateColumnFilter, {
    shouldCloseBillingRateColumnFilter,
} from "./BillingRateColumnFilter";

describe("BillingRateColumnFilter", () => {
    it("detects whether a pointer target is outside the dropdown root", () => {
        const insideTarget = {} as Node;
        const outsideTarget = {} as Node;
        const root = {
            contains: vi.fn((target: Node | null) => target === insideTarget),
        };

        expect(shouldCloseBillingRateColumnFilter(root, insideTarget)).toBe(false);
        expect(shouldCloseBillingRateColumnFilter(root, outsideTarget)).toBe(true);
        expect(shouldCloseBillingRateColumnFilter(root, null)).toBe(false);
        expect(shouldCloseBillingRateColumnFilter(null, outsideTarget)).toBe(false);
    });

    it("renders the filter as a closed dropdown by default", () => {
        const html = renderToStaticMarkup(
            <BillingRateColumnFilter
                label="Project"
                value=""
                allLabel="All projects"
                searchPlaceholder="Search projects"
                options={["Winter Gala"]}
                onChange={() => undefined}
            />
        );

        expect(html).toContain("billingRatesColumnFilter");
        expect(html).toContain("Project");
        expect(html).not.toContain("<details open=");
    });
});
