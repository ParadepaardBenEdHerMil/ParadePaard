import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import {
    AdminApplicationQueue,
    type ApplicationDecisionState,
} from "./AdminApplications";
import {
    AdminApplicationDetailsView,
} from "./AdminApplicationDetails";
import type { JobApplicationResponseDTO } from "../services/user-service/UserServices";

vi.mock("../components/Navbar", () => ({
    default: function MockNavbar() {
        return <nav aria-label="Navbar" />;
    },
}));

vi.mock("../components/PrimaryNav", () => ({
    default: function MockPrimaryNav() {
        return <nav aria-label="Primary navigation" />;
    },
}));

const submittedApplication: JobApplicationResponseDTO = {
    applicationId: "application-1",
    firstNames: "Alex Maria",
    preferredName: "Alex",
    middleNamePrefix: "van",
    lastName: "Jansen",
    email: "alex@example.com",
    phoneNumber: "+31612345678",
    dateOfBirth: "2000-02-03",
    city: "Amsterdam",
    country: "Netherlands",
    roleInterest: "Bar team",
    contractPreference: "On-call",
    availableFrom: "2026-06-01",
    note: "Weekends and evenings",
    workedForUsBefore: false,
    contactConsent: true,
    informationAccurate: true,
    cvFileName: "alex-cv.pdf",
    status: "APPLICATION_SUBMITTED",
    decisionEmailSent: false,
    submittedAt: "2026-05-17T10:30:00Z",
};

describe("AdminApplications", () => {
    it("renders submitted application rows with applicant and review details", () => {
        const html = renderToStaticMarkup(
            <MemoryRouter>
                <AdminApplicationQueue
                    applications={[submittedApplication]}
                    loading={false}
                    error={null}
                    onRefresh={() => undefined}
                />
            </MemoryRouter>
        );

        expect(html).toContain("Alex Maria van Jansen");
        expect(html).toContain("alex@example.com");
        expect(html).toContain("+31612345678");
        expect(html).toContain("Bar team");
        expect(html).toContain("On-call");
        expect(html).toContain("Submitted");
        expect(html).toContain("/management/applications/application-1");
    });

    it("renders accept and deny controls for submitted application details", () => {
        const decisionState: ApplicationDecisionState = {
            note: "",
            loading: false,
            message: null,
            error: null,
        };

        const html = renderToStaticMarkup(
            <MemoryRouter>
                <AdminApplicationDetailsView
                    application={submittedApplication}
                    loading={false}
                    error={null}
                    decision={decisionState}
                    cvLoading={false}
                    cvError={null}
                    onDecisionNoteChange={() => undefined}
                    onAccept={() => undefined}
                    onDeny={() => undefined}
                    onResendDecisionEmail={() => undefined}
                    onDownloadCv={() => undefined}
                    onReload={() => undefined}
                />
            </MemoryRouter>
        );

        expect(html).toContain("Accept application");
        expect(html).toContain("Deny application");
        expect(html).toContain("Review note");
        expect(html).toContain("Download CV");
        expect(html).toContain("Decision email pending");
    });

    it("keeps decision feedback visible after the application leaves submitted status", () => {
        const acceptedApplication: JobApplicationResponseDTO = {
            ...submittedApplication,
            status: "APPLICATION_ACCEPTED",
        };
        const decisionState: ApplicationDecisionState = {
            note: "Strong fit",
            loading: false,
            message: "Decision saved. Decision email is pending and may need manual follow-up.",
            error: null,
        };

        const html = renderToStaticMarkup(
            <MemoryRouter>
                <AdminApplicationDetailsView
                    application={acceptedApplication}
                    loading={false}
                    error={null}
                    decision={decisionState}
                    cvLoading={false}
                    cvError={null}
                    onDecisionNoteChange={() => undefined}
                    onAccept={() => undefined}
                    onDeny={() => undefined}
                    onResendDecisionEmail={() => undefined}
                    onDownloadCv={() => undefined}
                    onReload={() => undefined}
                />
            </MemoryRouter>
        );

        expect(html).toContain("Decision saved. Decision email is pending and may need manual follow-up.");
        expect(html).toContain("Resend decision email");
        expect(html).toContain("Decision actions are closed because this application is accepted.");
        expect(html).not.toContain("Accept application");
        expect(html).not.toContain("Deny application");
    });

    it("shows the simplified applicant note without an empty experience section", () => {
        const simplifiedApplication: JobApplicationResponseDTO = {
            ...submittedApplication,
            note: "Can start after exams.",
        };
        const decisionState: ApplicationDecisionState = {
            note: "",
            loading: false,
            message: null,
            error: null,
        };

        const html = renderToStaticMarkup(
            <MemoryRouter>
                <AdminApplicationDetailsView
                    application={simplifiedApplication}
                    loading={false}
                    error={null}
                    decision={decisionState}
                    cvLoading={false}
                    cvError={null}
                    onDecisionNoteChange={() => undefined}
                    onAccept={() => undefined}
                    onDeny={() => undefined}
                    onResendDecisionEmail={() => undefined}
                    onDownloadCv={() => undefined}
                    onReload={() => undefined}
                />
            </MemoryRouter>
        );

        expect(html).toContain("Note");
        expect(html).toContain("Can start after exams.");
        expect(html).not.toContain("<h2>Experience</h2>");
    });
});
