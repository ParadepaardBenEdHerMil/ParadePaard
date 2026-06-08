import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Onboarding from "./Onboarding";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({
        status: "PENDING_SETUP",
        setStatus: vi.fn(),
    }),
}));

describe("Onboarding", () => {
    it("uses account-setup wording for the onboarding entry screen", () => {
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
