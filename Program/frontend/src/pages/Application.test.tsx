import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import Application, { formatApplicationDateEntry, submitApplicationForm, toApplicationPayload } from "./Application";
import { UserServices } from "../services/user-service/UserServices";

describe("Application", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renders the public application form fields", () => {
        const html = renderToStaticMarkup(<Application />);

        expect(html).toContain("Full first names");
        expect(html).toContain('placeholder="Jan Jeroen"');
        expect(html).toContain("Preferred name");
        expect(html).toContain('placeholder="Jan"');
        expect(html).toContain("Prefix");
        expect(html).toContain('placeholder="van"');
        expect(html).toContain("Surname");
        expect(html).toContain('placeholder="Dijk"');
        expect(html).toContain("Email address");
        expect(html).toContain("Phone number");
        expect(html).toContain("Date of birth");
        expect(html.match(/placeholder="dd\/mm\/yyyy"/g)).toHaveLength(2);
        expect(html).toContain("Role interest");
        expect(html).toContain("Contract preference");
        expect(html.indexOf("CV upload")).toBeLessThan(html.indexOf("Profile picture"));
        expect(html).toContain("Profile picture");
        expect(html).toContain("Choose profile picture");
        expect(html).toContain("Adjust visible profile area");
        expect(html).toContain("Note");
        expect(html).not.toContain("Availability notes");
        expect(html).not.toContain("Relevant experience");
        expect(html).not.toContain("Languages");
        expect(html).not.toContain("Certificates");
        expect(html).not.toContain("Short motivation");
        expect(html).toContain("Worked for ParadePaard before");
        expect(html).toContain("Choose CV file");
        expect(html).toContain("Use a file up to 15 MB.");
        expect(html).toContain("No file selected");
        expect(html).toContain("Submit application");
    });

    it("renders checkbox inputs before their labels", () => {
        const html = renderToStaticMarkup(<Application />);

        expect(html).toMatch(/<label class="applicationCheck[^"]*"><input[^>]*type="checkbox"[^>]*\/><span>Worked for ParadePaard before<\/span><\/label>/);
        expect(html).toMatch(/<label class="applicationCheck[^"]*"><input[^>]*required=""[^>]*type="checkbox"[^>]*\/><span>I agree that ParadePaard may contact me about this application\.<\/span><\/label>/);
        expect(html).toMatch(/<label class="applicationCheck[^"]*"><input[^>]*required=""[^>]*type="checkbox"[^>]*\/><span>I confirm that the information I submitted is accurate\.<\/span><\/label>/);
    });

    it("builds the application payload with all supported non-sensitive fields", () => {
        expect(toApplicationPayload({
            firstNames: " Alex Maria ",
            preferredName: " Alex ",
            middleNamePrefix: " van ",
            lastName: " Jansen ",
            email: " alex@example.com ",
            phoneNumber: " +31612345678 ",
            dateOfBirth: "03/02/2000",
            gender: "Female",
            nationality: "Dutch",
            city: "Amsterdam",
            country: "Netherlands",
            roleInterest: " Bar team ",
            contractPreference: "On-call",
            availableFrom: "01/06/2026",
            note: " Weekends and evenings ",
            workedForUsBefore: true,
            contactConsent: true,
            informationAccurate: true,
        })).toEqual({
            firstNames: "Alex Maria",
            preferredName: "Alex",
            middleNamePrefix: "van",
            lastName: "Jansen",
            email: "alex@example.com",
            phoneNumber: "+31612345678",
            dateOfBirth: "2000-02-03",
            gender: "Female",
            nationality: "Dutch",
            city: "Amsterdam",
            country: "Netherlands",
            roleInterest: "Bar team",
            contractPreference: "On-call",
            availableFrom: "2026-06-01",
            note: "Weekends and evenings",
            workedForUsBefore: true,
            contactConsent: true,
            informationAccurate: true,
        });
    });

    it("auto-formats typed application dates as dd/mm/yyyy", () => {
        expect(formatApplicationDateEntry("03022000")).toBe("03/02/2000");
        expect(formatApplicationDateEntry("03-02-2000")).toBe("03/02/2000");
        expect(formatApplicationDateEntry("0302")).toBe("03/02");
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
                preferredName: "Alex",
                middleNamePrefix: "van",
                note: "Weekends",
                workedForUsBefore: true,
                contactConsent: true,
                informationAccurate: true,
                hasProfilePicture: true,
                profilePictureFileName: "alex.png",
                status: "APPLICATION_SUBMITTED",
            });
        const profilePicture = new File(["image"], "alex.png", { type: "image/png" });

        await submitApplicationForm({
            firstNames: "Alex Maria",
            lastName: "Jansen",
            email: "alex@example.com",
            phoneNumber: "+31612345678",
            dateOfBirth: "2000-02-03",
            roleInterest: "Bar team",
            contractPreference: "On-call",
            preferredName: "Alex",
            middleNamePrefix: "van",
            note: "Weekends",
            workedForUsBefore: true,
            contactConsent: true,
            informationAccurate: true,
        }, profilePicture);

        expect(submitApplication).toHaveBeenCalledWith(
            expect.objectContaining({
                firstNames: "Alex Maria",
                lastName: "Jansen",
                email: "alex@example.com",
                phoneNumber: "+31612345678",
                dateOfBirth: "2000-02-03",
                roleInterest: "Bar team",
                contractPreference: "On-call",
                preferredName: "Alex",
                middleNamePrefix: "van",
                note: "Weekends",
                workedForUsBefore: true,
                contactConsent: true,
                informationAccurate: true,
            }),
            profilePicture,
            null
        );
        expect(renderToStaticMarkup(<Application initialSubmitted />)).toContain("Application submitted");
    });
});
