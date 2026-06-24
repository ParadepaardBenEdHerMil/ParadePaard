import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("WorkHistory styles", () => {
    it("removes the underline from the management travel claims action", () => {
        const workHistoryCss = readFileSync(new URL("../stylesheets/WorkHistory.css", import.meta.url), "utf8");

        expect(workHistoryCss).toContain(".workHistoryHeader .button");
        expect(workHistoryCss).toContain("text-decoration: none");
    });
});
