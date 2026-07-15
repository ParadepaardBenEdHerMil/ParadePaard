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
import type { EmailPresetResponseDTO } from "../services/user-service/EmailPresets";
import { formatDate, formatDateTime } from "../utils/dateFormat";
import DocumentPreviewModal from "../components/common/DocumentPreviewModal";
import FilePreviewModal from "../components/common/FilePreviewModal";
import { buildApplicationDocument, documentFileBaseName } from "../utils/documentPreview";
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

export type DecisionEmail = { subject: string; body: string };

type AdminApplicationDetailsViewProps = {
    application: JobApplicationResponseDTO | null;
    /** Preset emails for the Applications group, split by category into reject / request-changes. */
    applicationPresets?: EmailPresetResponseDTO[];
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
    onDeny: (email?: DecisionEmail) => void;
    onRequestChanges: (email?: DecisionEmail) => void;
    onResendDecisionEmail: () => void;
    onToggleReapplicationBlock: () => void;
    reapplicationBlockLoading: boolean;
    onDownloadCv: () => void;
    /** Fetches the CV bytes for the inline preview. When omitted, the Preview control is hidden. */
    onLoadCv?: () => Promise<Blob>;
    onReload: () => void;
};

export function AdminApplicationDetailsView({
    application,
    applicationPresets = [],
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
    onRequestChanges,
    onResendDecisionEmail,
    onToggleReapplicationBlock,
    reapplicationBlockLoading,
    onDownloadCv,
    onLoadCv,
    onReload,
}: AdminApplicationDetailsViewProps) {
    const [profilePictureViewerOpen, setProfilePictureViewerOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [cvPreviewOpen, setCvPreviewOpen] = useState(false);
    // Reject and request-changes presets are kept strictly apart: each action can only pick from
    // its own list, so a reject email can never be sent as a request-changes decision or vice versa.
    const rejectPresets = applicationPresets.filter((preset) => preset.category === "REJECT");
    const changesPresets = applicationPresets.filter((preset) => preset.category === "REQUEST_CHANGES");
    // Two-step decision: pick the action, then (for reject / request-changes) pick a preset email.
    const [selectedDecision, setSelectedDecision] = useState<"" | "accept" | "requestChanges" | "deny">("");
    const [selectedPresetId, setSelectedPresetId] = useState("");
    const presetEmail = (presets: EmailPresetResponseDTO[], id: string): DecisionEmail | undefined => {
        const preset = presets.find((item) => item.id === id);
        return preset ? { subject: preset.subject, body: preset.body } : undefined;
    };
    // The preset list for the second dropdown depends on the chosen action; Accept has none.
    const decisionPresets =
        selectedDecision === "deny" ? rejectPresets : selectedDecision === "requestChanges" ? changesPresets : [];
    const normalizedStatus = (application?.status ?? "").toUpperCase();
    const isSubmitted = normalizedStatus === "APPLICATION_SUBMITTED";
    const isChangesRequested = normalizedStatus === "APPLICATION_CHANGES_REQUESTED";
    // Accept / reject / request-changes stay open while an application is still at the apply stage
    // (submitted, or already sent back for changes and awaiting a fresh submission).
    const isActionable = isSubmitted || isChangesRequested;
    const isAccepted = normalizedStatus === "APPLICATION_ACCEPTED";
    const decisionEmailPending = application?.decisionEmailSent === false;

    const applicantName = application ? applicationFullName(application) : "applicant";
    const profilePictureDownloadName =
        application?.profilePictureFileName ??
        `${(applicantName || "applicant").trim().toLowerCase().replace(/\s+/g, "-")}-profile-picture.jpg`;
    const previewDocument = application ? buildApplicationDocument(application) : null;

    return (
      <>
        <Card
            title={application ? applicationFullName(application) : "Application details"}
            right={
                <>
                    <button
                        className="button buttonSecondary docPreviewTrigger"
                        type="button"
                        onClick={() => setPreviewOpen(true)}
                        disabled={loading || !application}
                    >
                        Document preview
                    </button>
                    <button
                        className="button buttonSecondary"
                        type="button"
                        onClick={onReload}
                        disabled={loading}
                    >
                        Refresh
                    </button>
                </>
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
                        <DetailField label="First names" value={application.firstNames} />
                        <DetailField label="Preferred" value={application.preferredName} />
                        <DetailField label="Prefix" value={application.middleNamePrefix} />
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
                                <div className="applicationDocumentActions">
                                    {onLoadCv ? (
                                        <button
                                            className="button buttonSecondary"
                                            type="button"
                                            onClick={() => setCvPreviewOpen(true)}
                                        >
                                            Preview CV
                                        </button>
                                    ) : null}
                                    <button
                                        className="button buttonSecondary"
                                        type="button"
                                        onClick={onDownloadCv}
                                        disabled={cvLoading}
                                    >
                                        {cvLoading ? "Preparing CV..." : "Download CV"}
                                    </button>
                                </div>
                            ) : null}
                        </div>
                        {cvError ? <div className="applicationInlineError">{cvError}</div> : null}
                    </section>

                    <DetailSection title="Applicant confirmation">
                        <DetailField label="Consent to contact" value={application.contactConsent} />
                        <DetailField label="Information accurate" value={application.informationAccurate} />
                    </DetailSection>

                    {application.reapplicant ? (
                        <section className="applicationDetailSection applicationReapplicantSection">
                            <h2>
                                Reapplicant
                                {application.priorApplicationCount
                                    ? ` · ${application.priorApplicationCount} previous application${application.priorApplicationCount === 1 ? "" : "s"}`
                                    : ""}
                            </h2>
                            <p className="applicationReapplicantIntro">
                                This person has applied before. The most recent prior decision is shown so you
                                can review it against this application.
                            </p>
                            <div className="applicationDetailGrid">
                                <DetailField
                                    label="Previous decision"
                                    value={application.priorDecision ? applicationStatusLabel(application.priorDecision) : "-"}
                                />
                                <DetailField label="Decided at" value={formatDateTime(application.priorDecisionAt)} />
                                <DetailField label="Previous review note" value={application.priorReviewNote} />
                            </div>
                        </section>
                    ) : null}

                    <section className="applicationDetailSection">
                        <h2>Internal review</h2>
                        <div className="applicationReviewNoteExisting">
                            <DetailField label="Stored review note" value={application.reviewNote} />
                            <DetailField label="Reviewed at" value={formatDateTime(application.reviewedAt)} />
                            <DetailField label="Accepted user id" value={application.acceptedUserId} />
                        </div>

                        {canReview ? (
                            <div className="applicationReapplyBlockRow">
                                <div className="applicationReapplyBlockText">
                                    <div className="applicationReapplyBlockTitle">
                                        {application.reapplicationBlocked
                                            ? "Reapplications blocked for this person"
                                            : "Reapplications allowed for this person"}
                                    </div>
                                    <div className="applicationReapplyBlockSub">
                                        {application.reapplicationBlocked
                                            ? "This email can't submit a new application, even if the company allows reapplications."
                                            : "Block this email from submitting a new application (overrides the company setting)."}
                                    </div>
                                </div>
                                <button
                                    className={`button ${application.reapplicationBlocked ? "buttonSecondary" : "buttonSecondary applicationDenyButton"}`}
                                    type="button"
                                    onClick={onToggleReapplicationBlock}
                                    disabled={reapplicationBlockLoading}
                                >
                                    {reapplicationBlockLoading
                                        ? "Saving..."
                                        : application.reapplicationBlocked
                                          ? "Allow reapplications"
                                          : "Block reapplications"}
                                </button>
                            </div>
                        ) : null}

                        {decision.message ? (
                            <div className="applicationInlineSuccess">{decision.message}</div>
                        ) : null}
                        {decision.error ? (
                            <div className="applicationInlineError">{decision.error}</div>
                        ) : null}

                        {isActionable && canReview ? (
                            <div className="applicationDecisionPanel">
                                <label className="applicationReviewNote">
                                    <span>Review note</span>
                                    <textarea
                                        value={decision.note}
                                        onChange={(event) => onDecisionNoteChange(event.target.value)}
                                        placeholder="Add an internal note for this decision"
                                    />
                                </label>
                                <p className="applicationDecisionHint">
                                    Requesting changes emails the applicant asking them to submit an updated
                                    application; rejecting emails them that they were not selected. The review
                                    note above stays internal.
                                </p>
                                <div className="applicationDecisionFields">
                                    <label className="applicationPresetPicker">
                                        <span>Decision</span>
                                        <select
                                            value={selectedDecision}
                                            onChange={(event) => {
                                                setSelectedDecision(
                                                    event.target.value as typeof selectedDecision
                                                );
                                                setSelectedPresetId("");
                                            }}
                                        >
                                            <option value="">Choose a decision…</option>
                                            <option value="accept">Accept application</option>
                                            <option value="requestChanges">Request changes</option>
                                            <option value="deny">Reject application</option>
                                        </select>
                                    </label>
                                    {selectedDecision === "deny" || selectedDecision === "requestChanges" ? (
                                        <label className="applicationPresetPicker">
                                            <span>Email</span>
                                            {decisionPresets.length > 0 ? (
                                                <select
                                                    value={selectedPresetId}
                                                    onChange={(event) => setSelectedPresetId(event.target.value)}
                                                >
                                                    <option value="">Choose an email…</option>
                                                    {decisionPresets.map((preset) => (
                                                        <option key={preset.id} value={preset.id}>
                                                            {preset.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <div className="applicationDecisionNoPresets">
                                                    No {selectedDecision === "deny" ? "reject" : "request-changes"} email
                                                    presets yet — create one on the Email presets page before you can
                                                    {selectedDecision === "deny" ? " reject" : " request changes"}.
                                                </div>
                                            )}
                                        </label>
                                    ) : null}
                                </div>
                                <div className="applicationDecisionActions">
                                    <button
                                        className={
                                            selectedDecision === "deny"
                                                ? "button buttonSecondary applicationDenyButton"
                                                : "button"
                                        }
                                        type="button"
                                        onClick={() => {
                                            if (selectedDecision === "accept") {
                                                onAccept();
                                            } else if (selectedDecision === "requestChanges") {
                                                onRequestChanges(presetEmail(changesPresets, selectedPresetId));
                                            } else if (selectedDecision === "deny") {
                                                onDeny(presetEmail(rejectPresets, selectedPresetId));
                                            }
                                        }}
                                        disabled={
                                            decision.loading
                                            || !selectedDecision
                                            || ((selectedDecision === "deny" || selectedDecision === "requestChanges")
                                                && !selectedPresetId)
                                        }
                                    >
                                        {decision.loading
                                            ? "Saving…"
                                            : selectedDecision === "accept"
                                              ? "Accept application"
                                              : selectedDecision === "requestChanges"
                                                ? "Request changes"
                                                : selectedDecision === "deny"
                                                  ? "Reject application"
                                                  : "Apply decision"}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="applicationDecisionClosed">
                                {isActionable
                                    ? "Your account can view applications but cannot accept, reject, or request changes on them."
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
        <DocumentPreviewModal
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
            document={previewDocument}
            fileBaseName={documentFileBaseName("application", applicantName)}
        />
        {onLoadCv ? (
            <FilePreviewModal
                open={cvPreviewOpen}
                onClose={() => setCvPreviewOpen(false)}
                fileName={application?.cvFileName}
                contentType={application?.cvContentType}
                load={onLoadCv}
                onDownload={onDownloadCv}
                downloading={cvLoading}
            />
        ) : null}
      </>
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
    const [reapplicationBlockLoading, setReapplicationBlockLoading] = useState(false);
    const [applicationPresets, setApplicationPresets] = useState<EmailPresetResponseDTO[]>([]);
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

    // Applicant reject / request-changes presets. Tolerant of a permission gap: on failure the
    // pickers simply don't appear and the default templates are used.
    useEffect(() => {
        let cancelled = false;
        UserServices.getEmailPresets()
            .then((all) => {
                if (!cancelled) {
                    setApplicationPresets(all.filter((preset) => preset.groupType === "APPLICATIONS"));
                }
            })
            .catch(() => {
                if (!cancelled) setApplicationPresets([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

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
        async (action: "accept" | "deny" | "requestChanges", email?: DecisionEmail) => {
            if (!applicationId) return;
            try {
                setDecision((current) => ({ ...current, loading: true, message: null, error: null }));
                const payload = {
                    reviewNote: decision.note.trim() || null,
                    emailSubject: email?.subject?.trim() || null,
                    emailBody: email?.body?.trim() || null,
                };
                let data: JobApplicationResponseDTO;
                if (action === "accept") {
                    data = await UserServices.acceptApplication(applicationId, payload);
                } else if (action === "requestChanges") {
                    data = await UserServices.requestApplicationChanges(applicationId, payload);
                } else {
                    data = await UserServices.denyApplication(applicationId, payload);
                }
                setApplication(data);
                const savedLabel = action === "requestChanges" ? "Changes requested." : "Decision saved.";
                setDecision((current) => ({
                    ...current,
                    loading: false,
                    message:
                        data.decisionEmailSent === false
                            ? `${savedLabel} The applicant email is pending and may need manual follow-up.`
                            : savedLabel,
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

    const toggleReapplicationBlock = useCallback(async () => {
        if (!applicationId || !application) return;
        try {
            setReapplicationBlockLoading(true);
            setDecision((current) => ({ ...current, message: null, error: null }));
            const data = await UserServices.setApplicationReapplicationBlock(
                applicationId,
                !application.reapplicationBlocked
            );
            setApplication(data);
            setDecision((current) => ({
                ...current,
                message: data.reapplicationBlocked
                    ? "This applicant can no longer reapply."
                    : "This applicant can reapply again.",
                error: null,
            }));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update reapplication setting.";
            setDecision((current) => ({ ...current, error: message }));
        } finally {
            setReapplicationBlockLoading(false);
        }
    }, [applicationId, application]);

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

    // Fetches the raw CV bytes for the inline preview. Memoized so the preview modal's
    // load effect runs once per open rather than on every parent render.
    const loadCv = useCallback(async (): Promise<Blob> => {
        if (!applicationId) throw new Error("Missing application id.");
        return UserServices.getApplicationCv(applicationId);
    }, [applicationId]);

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
                                applicationPresets={applicationPresets}
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
                                onDeny={(email) => void makeDecision("deny", email)}
                                onRequestChanges={(email) => void makeDecision("requestChanges", email)}
                                onResendDecisionEmail={() => void resendDecisionEmail()}
                                onToggleReapplicationBlock={() => void toggleReapplicationBlock()}
                                reapplicationBlockLoading={reapplicationBlockLoading}
                                onDownloadCv={() => void downloadCv()}
                                onLoadCv={loadCv}
                                onReload={() => void loadApplication()}
                            />
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}
