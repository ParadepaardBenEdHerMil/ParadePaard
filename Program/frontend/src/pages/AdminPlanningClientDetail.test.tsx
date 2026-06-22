import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const adminPlanningClientDetailSource = readFileSync(
    fileURLToPath(new URL("./AdminPlanningClientDetail.tsx", import.meta.url)),
    "utf8"
);

describe("AdminPlanningClientDetail layout", () => {
    it("renders the detail tabs below the client overview card content", () => {
        const identityIndex = adminPlanningClientDetailSource.indexOf('className="adminUserIdentity"');
        const tabsIndex = adminPlanningClientDetailSource.indexOf('className="adminUserDetailsTabs"');

        expect(identityIndex).toBeGreaterThan(-1);
        expect(tabsIndex).toBeGreaterThan(-1);
        expect(tabsIndex).toBeGreaterThan(identityIndex);
    });
});
