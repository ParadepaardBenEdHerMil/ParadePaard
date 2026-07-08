import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import ProfilePictureViewer from "../components/common/ProfilePictureViewer";
import { useAuth } from "../context/AuthContext";
import { UserServices, type JobApplicationResponseDTO } from "../services/user-service/UserServices";
import { formatDate, formatDateTime } from "../utils/dateFormat";
import {
    applicationFullName,
    applicationStatusClass,
    applicationStatusLabel,
    type ApplicationDecisionState,
} from "./AdminApplications";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminApplications.css";

type DetailFieldProps = {
    label: string;
    value: string | boolean | null | undefined;
};

function formatValue(value: string | boolean | null | undefined): string {
    if (value === null || value === undefined || value === "") return "-";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return value;
}

function DetailField({ label, value }: DetailFieldProps) {
    return (
        <div className="applicationDetailField">
            <div className="applicationDetailLabel">{label}</div>
            <div className="applicationDetailValue">{formatValue(value)}</div>
        </div>
    );
}

type DetailSectionProps = {
    title: string;
    children: ReactNode;
};

function DetailSection({ title, children }: DetailSectionProps) {
    return (
        <section className="applicationDetailSection">
            <h2>{title}</h2>
            <div className="applicationDetailGrid">{children}</div>
        </section>
    );
}

type AdminApplicationDetailsViewProps = {
    application: JobApplicationResponseDTO | null;
    loading: boolean;
    error: string | null;
    decision: ApplicationDecisionState;
    cvLoading: boolean;
    cvError: string | null;
    profilePictureUrl: string | null;
    profilePictureLoading: boolean;
    profilePictureError: string | null;
    canReview?: boolean;
    onDecisionNoteChange: (value: string) => void;
    onAccept: () => void;
    onDeny: () => void;
    onResendDecisionEmail: () => void;
    onDownloadCv: () => void;
    onReload: () => void;
};

export function AdminApplicationDetailsView({
    application,
    loading,
    error,
    decision,
    cvLoading,
    cvError,
    profilePictureUrl,
    profilePictureLoading,
    profilePictureError,
    canReview = true,
    onDecisionNoteChange,
    onAccept,
    onDeny,
    onResendDecisionEmail,
    onDownloadCv,
    onReload,
}: AdminApplicationDetailsViewProps) {
    const [profilePictureViewerOpen, setProfilePictureViewerOpen] = useState(false);
    const isSubmitted = (application?.status ?? "").toUpperCase() === "APPLICATION_SUBMITTED";
    const isAccepted = (application?.status ?? "").toUpperCase() === "APPLICATION_ACCEPTED";
    const decisionEmailPending = application?.decisionEmailSent === false;

    const applicantName = application ? applicationFullName(application) : "applicant";
    const profilePictureDownloadName =
        application?.profilePictureFileName ??
        `${(applicantName || "applicant").trim().toLowerCase().replace(/\s+/g, "-")}-profile-picture.jpg`;

    return (
        <Card
            title={application ? applicationFullName(application) : "Application details"}
            right={
                <button
                    className="button buttonSecondary"
                    type="button"
                    onClick={onReload}
                    disabled={loading}
                >
                    Refresh
                </button>
            }
        >
            {loading ? <div className="listEmpty">Loading application...</div> : null}
            {error ? <div className="listEmpty errorText">{error}</div> : null}
            {!loading && !error && !application ? (
                <div className="listEmpty">Application not found.</div>
            ) : null}

            {!loading && !error && application ? (
                <div className="applicationDetailPage">
                    <div className="applicationDetailSummary">
                        <div>
                            <div className="applicationDetailSummaryLabel">Status</div>
                            <div className={applicationStatusClass(application.status)}>
                                {applicationStatusLabel(application.status)}
                            </div>
                        </div>
                        <div>
                            <div className="applicationDetailSummaryLabel">Submitted</div>
                            <div>{formatDateTime(application.submittedAt)}</div>
                        </div>
                        <div>
                            <div className="applicationDetailSummaryLabel">Decision email</div>
                            <div>
                                {decisionEmailPending
                                    ? "Decision email pending"
                                    : application.decisionEmailSent === true
                                      ? "Decision email sent"
                                      : "No decision email recorded"}
                            </div>
                        </div>
                    </div>

                    <section className="applicationDetailSection">
                        <h2>Applicant photo</h2>
                        <div className="applicationProfilePanel">
                            <div className="applicationProfileFrame" aria-label="Applicant profile picture">
                                {profilePictureUrl ? (
                                    <button
                                        type="button"
                                        className="applicationProfileViewButton"
                                        onClick={() => setProfilePictureViewerOpen(true)}
                                        aria-label={`View photo for ${applicantName}`}
                                    >
                                        <img src={profilePictureUrl} alt="Applicant profile" />
                                        <span className="applicationProfileViewHint">View</span>
                                    </button>
                                ) : (
                                    <div className="applicationProfileFallback">
                                        {profilePictureLoading
                                            ? "Loading picture..."
                                            : application.hasProfilePicture
                                              ? "Picture unavailable"
                                              : "No picture submitted"}
                                    </div>
                                )}
                            </div>
                            <div className="applicationProfileMeta">
                                <div className="applicationDetailLabel">Profile picture file</div>
                                <div className="applicationDetailValue">
                                    {application.profilePictureFileName ?? "-"}
                                </div>
                                <div className="applicationDetailValue">
                                    {application.hasProfilePicture
                                        ? "This photo will prefill the accepted user account avatar."
                                        : "Older applications may not include a photo."}
                                </div>
                            </div>
                        </div>
                        {profilePictureError ? (
                            <div className="applicationInlineError">{profilePictureError}</div>
                        ) : null}
                        <ProfilePictureViewer
                            open={profilePictureViewerOpen}
                            src={profilePictureUrl}
                            alt={`${applicantName} profile picture`}
                            downloadName={profilePictureDownloadName}
                            onClose={() => setProfilePictureViewerOpen(false)}
                        />
                    </section>

                    <DetailSection title="Personal details">
                        <DetailField label="Full first names" value={application.firstNames} />
                        <DetailField label="Preferred name" value={application.preferredName} />
                        <DetailField label="Middle name prefix" value={application.middleNamePrefix} />
                        <DetailField label="Surname" value={application.lastName} />
                        <DetailField label="Date of birth" value={formatDate(application.dateOfBirth)} />
                        <DetailField label="Gender" value={application.gender} />
                        <DetailField label="Nationality" value={application.nationality} />
                        <DetailField label="Worked for ParadePaard before" value={application.workedForUsBefore} />
                    </DetailSection>

                    <DetailSection title="Contact details">
                        <DetailField label="Email address" value={application.email} />
                        <DetailField label="Phone number" value={application.phoneNumber} />
                        <DetailField label="City" value={application.city} />
                        <DetailField label="Country" value={application.country} />
                    </DetailSection>

                    <DetailSection title="Work interest">
                        <DetailField label="Role interest" value={application.roleInterest} />
                        <DetailField label="Contract preference" value={application.contractPreference} />
                        <DetailField label="Available from" value={formatDate(application.availableFrom)} />
                        <DetailField label="Note" value={application.note} />
                    </DetailSection>

                    <section className="applicationDetailSection">
                        <h2>Application files</h2>
                        <div className="applicationDocumentRow">
                            <div>
                                <div className="applicationDetailLabel">CV file</div>
                                <div className="applicationDetailValue">{application.cvFileName ?? "-"}</div>
                            </div>
                            {application.cvFileName ? (
                                <button
                                    className="button buttonSecondary"
                                    type="button"
                                    onClick={onDownloadCv}
                                    disabled={cvLoading}
                                >
                                    {cvLoading ? "Preparing CV..." : "Download CV"}
                                </button>
                            ) : null}
                        </div>
                        {cvError ? <div className="applicationInlineError">{cvError}</div> : null}
                    </section>

                    <DetailSection title="Applicant confirmation">
                        <DetailField label="Consent to contact" value={application.contactConsent} />
                        <DetailField label="Information accurate" value={application.informationAccurate} />
                    </DetailSection>

                    <section className="applicationDetailSection">
                        <h2>Internal review</h2>
                        <div className="applicationReviewNoteExisting">
                            <DetailField label="Stored review note" value={application.reviewNote} />
                            <DetailField label="Reviewed at" value={formatDateTime(application.reviewedAt)} />
                            <DetailField label="Accepted user id" value={application.acceptedUserId} />
                        </div>

                        {decision.message ? (
                            <div className="applicationInlineSuccess">{decision.message}</div>
                        ) : null}
                        {decision.error ? (
                            <div className="applicationInlineError">{decision.error}</div>
                        ) : null}

                        {isSubmitted && canReview ? (
                            <div className="applicationDecisionPanel">
                                <label className="applicationReviewNote">
                                    <span>Review note</span>
                                    <textarea
                                        value={decision.note}
                                        onChange={(event) => onDecisionNoteChange(event.target.value)}
                                        placeholder="Add an internal note for this decision"
                                    />
                                </label>
                                <div className="applicationDecisionActions">
                                    <button
                                        className="button"
                                        type="button"
                                        onClick={onAccept}
                                        disabled={decision.loading}
                                    >
                                        Accept application
                                    </button>
                                    <button
                                        className="button buttonSecondary applicationDenyButton"
                                        type="button"
                                        onClick={onDeny}
                                        disabled={decision.loading}
                                    >
                                        Deny application
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="applicationDecisionClosed">
                                {isSubmitted
                                    ? "Your account can view applications but cannot accept or deny them."
                                    : `Decision actions are closed because this application is ${applicationStatusLabel(application.status).toLowerCase()}.`}
                            </div>
                        )}
                        {isAccepted && canReview ? (
                            <div className="applicationDecisionActions">
                                <button
                                    className="button"
                                    type="button"
                                    onClick={onResendDecisionEmail}
                                    disabled={decision.loading}
                                >
                                    {decision.loading ? "Sending..." : "Resend decision email"}
                                </button>
                            </div>
                        ) : null}
                    </section>
                </div>
            ) : null}
        </Card>
    );
}

export default function AdminApplicationDetails() {
    const { applicationId } = useParams<{ applicationId: string }>();
    const { permissions } = useAuth();
    const [application, setApplication] = useState<JobApplicationResponseDTO | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [decision, setDecision] = useState<ApplicationDecisionState>({
        note: "",
        loading: false,
        message: null,
        error: null,
    });
    const [cvLoading, setCvLoading] = useState(false);
    const [cvError, setCvError] = useState<string | null>(null);
    const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
    const [profilePictureLoading, setProfilePictureLoading] = useState(false);
    const [profilePictureError, setProfilePictureError] = useState<string | null>(null);

    const loadApplication = useCallback(async () => {
        if (!applicationId) {
            setError("Missing application id.");
            setLoading(false);
            return;
        }
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getApplication(applicationId);
            setApplication(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load application.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [applicationId]);

    useEffect(() => {
        void loadApplication();
    }, [loadApplication]);

    useEffect(() => {
        let cancelled = false;
        let objectUrl: string | null = null;

        async function loadProfilePicture() {
            if (!application?.applicationId || !application.hasProfilePicture) {
                setProfilePictureUrl(null);
                setProfilePictureError(null);
                setProfilePictureLoading(false);
                return;
            }

            try {
                setProfilePictureLoading(true);
                setProfilePictureError(null);
                const blob = await UserServices.getApplicationProfilePicture(application.applicationId);
                if (cancelled) {
                    return;
                }
                objectUrl = URL.createObjectURL(blob);
                setProfilePictureUrl(objectUrl);
            } catch (err: unknown) {
                if (cancelled) {
                    return;
                }
                const message = err instanceof Error ? err.message : "Failed to load profile picture.";
                setProfilePictureUrl(null);
                setProfilePictureError(message);
            } finally {
                if (!cancelled) {
                    setProfilePictureLoading(false);
                }
            }
        }

        void loadProfilePicture();

        return () => {
            cancelled = true;
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [application?.applicationId, application?.hasProfilePicture]);

    const makeDecision = useCallback(
        async (action: "accept" | "deny") => {
            if (!applicationId) return;
            try {
                setDecision((current) => ({ ...current, loading: true, message: null, error: null }));
                const payload = { reviewNote: decision.note.trim() || null };
                const data =
                    action === "accept"
                        ? await UserServices.acceptApplication(applicationId, payload)
                        : await UserServices.denyApplication(applicationId, payload);
                setApplication(data);
                setDecision((current) => ({
                    ...current,
                    loading: false,
                    message:
                        data.decisionEmailSent === false
                            ? "Decision saved. Decision email is pending and may need manual follow-up."
                            : "Decision saved.",
                    error: null,
                }));
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Failed to save decision.";
                setDecision((current) => ({ ...current, loading: false, message: null, error: message }));
            }
        },
        [applicationId, decision.note]
    );

    const resendDecisionEmail = useCallback(async () => {
        if (!applicationId) return;
        try {
            setDecision((current) => ({ ...current, loading: true, message: null, error: null }));
            const data = await UserServices.resendApplicationDecisionEmail(applicationId);
            setApplication(data);
            setDecision((current) => ({
                ...current,
                loading: false,
                message: "Decision email resent.",
                error: null,
            }));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to resend decision email.";
            setDecision((current) => ({ ...current, loading: false, message: null, error: message }));
        }
    }, [applicationId]);

    const downloadCv = useCallback(async () => {
        if (!applicationId || !application?.cvFileName) return;
        let objectUrl: string | null = null;
        try {
            setCvLoading(true);
            setCvError(null);
            const blob = await UserServices.getApplicationCv(applicationId);
            objectUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = objectUrl;
            link.download = application.cvFileName;
            link.rel = "noopener";
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to download CV.";
            setCvError(message);
        } finally {
            setCvLoading(false);
            if (objectUrl) {
                const urlToRevoke = objectUrl;
                window.setTimeout(() => URL.revokeObjectURL(urlToRevoke), 1000);
            }
        }
    }, [application?.cvFileName, applicationId]);

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <main className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/management/applications" />
                            <h1 className="pageTitle">Application details</h1>
                            <p className="pageSubtitle">
                                Review submitted applicant details without exposing file bytes in page data.
                            </p>
                        </header>
                        <div className="adminDashboardCard">
                            <AdminApplicationDetailsView
                                application={application}
                                loading={loading}
                                error={error}
                                decision={decision}
                                cvLoading={cvLoading}
                                cvError={cvError}
                                profilePictureUrl={profilePictureUrl}
                                profilePictureLoading={profilePictureLoading}
                                profilePictureError={profilePictureError}
                                canReview={permissions.includes("CAN_REVIEW_APPLICATIONS")}
                                onDecisionNoteChange={(note) =>
                                    setDecision((current) => ({ ...current, note }))
                                }
                                onAccept={() => void makeDecision("accept")}
                                onDeny={() => void makeDecision("deny")}
                                onResendDecisionEmail={() => void resendDecisionEmail()}
                                onDownloadCv={() => void downloadCv()}
                                onReload={() => void loadApplication()}
                            />
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}
