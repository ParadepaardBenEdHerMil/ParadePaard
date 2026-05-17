import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Application, { submitApplicationForm } from "./Application";
import { UserServices } from "../services/user-service/UserServices";

describe("Application", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders the public application form fields", () => {
        const html = renderToStaticMarkup(<Application />);

        expect(html).toContain("Full first names");
        expect(html).toContain("Surname");
        expect(html).toContain("Email address");
        expect(html).toContain("Phone number");
        expect(html).toContain("Date of birth");
        expect(html).toContain("Role interest");
        expect(html).toContain("Contract preference");
        expect(html).toContain("Submit application");
    });

    it("submits a minimal valid application and can show the success state", async () => {
        const submitApplication = vi
            .spyOn(UserServices, "submitApplication")
            .mockResolvedValue({
                applicationId: "application-1",
                firstNames: "Alex Maria",
                lastName: "Jansen",
                email: "alex@example.com",
                phoneNumber: "+31612345678",
                dateOfBirth: "2000-02-03",
                roleInterest: "Bar team",
                contractPreference: "On-call",
                workedForUsBefore: false,
                contactConsent: true,
                informationAccurate: true,
                status: "APPLICATION_SUBMITTED",
            });

        await submitApplicationForm({
            firstNames: "Alex Maria",
            lastName: "Jansen",
            email: "alex@example.com",
            phoneNumber: "+31612345678",
            dateOfBirth: "2000-02-03",
            roleInterest: "Bar team",
            contractPreference: "On-call",
            workedForUsBefore: false,
            contactConsent: true,
            informationAccurate: true,
        });

        expect(submitApplication).toHaveBeenCalledWith(
            expect.objectContaining({
                firstNames: "Alex Maria",
                lastName: "Jansen",
                email: "alex@example.com",
                phoneNumber: "+31612345678",
                dateOfBirth: "2000-02-03",
                roleInterest: "Bar team",
                contractPreference: "On-call",
                workedForUsBefore: false,
                contactConsent: true,
                informationAccurate: true,
            }),
            null
        );
        expect(renderToStaticMarkup(<Application initialSubmitted />)).toContain("Application submitted");
    });
});
