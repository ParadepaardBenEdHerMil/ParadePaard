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
    hasProfilePicture: true,
    profilePictureFileName: "alex.png",
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
        expect(html).toContain("Pending");
        expect(html).toContain("/management/applications/application-1");
    });

    it("renders the status switcher tabs", () => {
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

        expect(html).toContain("applicationStatusTabs");
        expect(html).toContain("Changes requested");
        expect(html).toContain("Accepted");
        expect(html).toContain("Rejected");
    });

    it("shows accepted applications (under the default All tab) instead of hiding them", () => {
        const acceptedApplication: JobApplicationResponseDTO = {
            ...submittedApplication,
            applicationId: "application-accepted",
            firstNames: "Robin",
            preferredName: "Robin",
            lastName: "de Boer",
            email: "robin@example.com",
            status: "APPLICATION_ACCEPTED",
        };

        const html = renderToStaticMarkup(
            <MemoryRouter>
                <AdminApplicationQueue
                    applications={[submittedApplication, acceptedApplication]}
                    loading={false}
                    error={null}
                    onRefresh={() => undefined}
                />
            </MemoryRouter>
        );

        expect(html).toContain("Alex Maria van Jansen");
        expect(html).toContain("robin@example.com");
        expect(html).toContain("/management/applications/application-accepted");
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
                    profilePictureUrl="blob:alex"
                    profilePictureLoading={false}
                    profilePictureError={null}
                    onDecisionNoteChange={() => undefined}
                    onAccept={() => undefined}
                    onDeny={() => undefined}
                    onRequestChanges={() => undefined}
                    onResendDecisionEmail={() => undefined}
                    onDownloadCv={() => undefined}
                    onReload={() => undefined}
                />
            </MemoryRouter>
        );

        expect(html).toContain("Accept application");
        expect(html).toContain("Request changes");
        expect(html).toContain("Reject application");
        expect(html).toContain("Review note");
        expect(html).toContain("Applicant photo");
        expect(html).toContain("Download CV");
        expect(html).toContain("Decision email pending");
    });

    it("renders the applicant photo as an inspectable view control", () => {
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
                    profilePictureUrl="blob:alex"
                    profilePictureLoading={false}
                    profilePictureError={null}
                    onDecisionNoteChange={() => undefined}
                    onAccept={() => undefined}
                    onDeny={() => undefined}
                    onRequestChanges={() => undefined}
                    onResendDecisionEmail={() => undefined}
                    onDownloadCv={() => undefined}
                    onReload={() => undefined}
                />
            </MemoryRouter>
        );

        expect(html).toContain("applicationProfileViewButton");
        expect(html).toContain("View photo for Alex Maria van Jansen");
        expect(html).toContain("applicationProfileViewHint");
    });

    it("shows a fallback instead of a view control when no photo is available", () => {
        const withoutPhoto: JobApplicationResponseDTO = {
            ...submittedApplication,
            hasProfilePicture: false,
            profilePictureFileName: null,
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
                    application={withoutPhoto}
                    loading={false}
                    error={null}
                    decision={decisionState}
                    cvLoading={false}
                    cvError={null}
                    profilePictureUrl={null}
                    profilePictureLoading={false}
                    profilePictureError={null}
                    onDecisionNoteChange={() => undefined}
                    onAccept={() => undefined}
                    onDeny={() => undefined}
                    onRequestChanges={() => undefined}
                    onResendDecisionEmail={() => undefined}
                    onDownloadCv={() => undefined}
                    onReload={() => undefined}
                />
            </MemoryRouter>
        );

        expect(html).not.toContain("applicationProfileViewButton");
        expect(html).toContain("No picture submitted");
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
                    profilePictureUrl="blob:alex"
                    profilePictureLoading={false}
                    profilePictureError={null}
                    onDecisionNoteChange={() => undefined}
                    onAccept={() => undefined}
                    onDeny={() => undefined}
                    onRequestChanges={() => undefined}
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
        expect(html).not.toContain("Reject application");
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
                    profilePictureUrl="blob:alex"
                    profilePictureLoading={false}
                    profilePictureError={null}
                    onDecisionNoteChange={() => undefined}
                    onAccept={() => undefined}
                    onDeny={() => undefined}
                    onRequestChanges={() => undefined}
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
