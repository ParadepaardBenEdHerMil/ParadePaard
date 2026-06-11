import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Onboarding from "./Onboarding";

let status = "PENDING_SETUP";
let permissions: string[] = [];

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        status,
        permissions,
        setStatus: vi.fn(),
    }),
}));

describe("Onboarding", () => {
    it("shows the management CTA while a management-capable account waits for review", () => {
        status = "PENDING_PROFILE_REVIEW";
        permissions = ["CAN_MANAGE_PLATFORM"];

        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Onboarding />
            </MemoryRouter>
        );

        expect(html).toContain("Awaiting review");
        expect(html).toContain("Go to management");
    });

    it("uses account-setup wording for the onboarding entry screen", () => {
        status = "PENDING_SETUP";
        permissions = [];

        const html = renderToStaticMarkup(
            <MemoryRouter>
                <Onboarding />
            </MemoryRouter>
        );

        expect(html).toContain("Complete your account setup");
        expect(html).toContain("Complete your required details so your account can be activated.");
        expect(html).not.toContain("Finish Your Setup");
    });
});
