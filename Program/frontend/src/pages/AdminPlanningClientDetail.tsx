import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";
import { NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import Modal from "../components/common/Modal";
import ProfilePictureViewer from "../components/common/ProfilePictureViewer";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Spinner from "../components/Spinner";
import {
    UserServices,
    type PlanningClientCompanyContactSaveDTO,
    type PlanningClientCompanyDTO,
    type PlanningClientCompanySaveDTO,
    type PlanningLocationDTO,
} from "../services/user-service/UserServices";
import { useAuth } from "../context/AuthContext";
import { BILLING_RATE_PERMISSIONS, hasAnyPermission } from "../utils/permissionPolicy";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/GeneralInfo.css";
import "../stylesheets/Profile.css";
import "../stylesheets/UserDashboard.css";
import "../stylesheets/AdminUserDetails.css";
import "../stylesheets/AdminPlanningClients.css";
import "../stylesheets/Settings.css";

const MAX_CLIENT_PROFILE_PICTURE_BYTES = 500_000;

const EMPTY_CONTACT: PlanningClientCompanyContactSaveDTO = {
    firstName: "",
    lastName: "",
    position: "",
    email: "",
    phone: "",
};

export type ClientDetailOutletContext = {
    client: PlanningClientCompanyDTO;
    formatValue: (value: string | number | boolean | null | undefined) => string | number;
};

function clientInitial(name?: string | null): string {
    return (name?.trim()?.[0] ?? "C").toUpperCase();
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Could not read image file."));
        reader.readAsDataURL(file);
    });
}

function clientToDraft(client: PlanningClientCompanyDTO): PlanningClientCompanySaveDTO {
    return {
        name: client.name ?? "",
        address: client.address ?? "",
        companyLine: client.companyLine ?? "",
        notes: client.notes ?? "",
        profilePictureUrl: client.profilePictureUrl ?? null,
        contacts: (client.contacts ?? []).map((contact) => ({
            firstName: contact.firstName ?? "",
            lastName: contact.lastName ?? "",
            position: contact.position ?? "",
            email: contact.email ?? "",
            phone: contact.phone ?? "",
        })),
    };
}

export default function AdminPlanningClientDetail() {
    const navigate = useNavigate();
    const { clientCompanyId } = useParams<{ clientCompanyId: string }>();
    const { permissions } = useAuth();
    const [client, setClient] = useState<PlanningClientCompanyDTO | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [locations, setLocations] = useState<PlanningLocationDTO[]>([]);

    const [editOpen, setEditOpen] = useState(false);
    const [editDraft, setEditDraft] = useState<PlanningClientCompanySaveDTO>({
        name: "",
        address: "",
        companyLine: "",
        notes: "",
        profilePictureUrl: null,
        contacts: [],
    });
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState<string | null>(null);

    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const [profilePictureViewerOpen, setProfilePictureViewerOpen] = useState(false);

    const loadClient = useCallback(async () => {
        if (!clientCompanyId) return;
        setLoading(true);
        setError(null);
        try {
            const data = await UserServices.getPlanningClients();
            const match = data.find((entry) => entry.clientCompanyId === clientCompanyId);
            if (!match) {
                setError("Client not found.");
                setClient(null);
            } else {
                setClient(match);
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load client.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [clientCompanyId]);

    useEffect(() => {
        let cancelled = false;
        void (async () => {
            await loadClient();
            if (cancelled) return;
        })();
        return () => {
            cancelled = true;
        };
    }, [loadClient]);

    useEffect(() => {
        if (!clientCompanyId) return;
        let cancelled = false;
        UserServices.getPlanningLocations(clientCompanyId)
            .then((data) => {
                if (!cancelled) setLocations(data);
            })
            .catch(() => {
                if (!cancelled) setLocations([]);
            });
        return () => {
            cancelled = true;
        };
    }, [clientCompanyId]);

    const detailRoot = `/management/clients/${clientCompanyId ?? ""}`;
    const detailLocations = `/management/clients/${clientCompanyId ?? ""}/locations`;
    const detailBillingRates = `/management/clients/${clientCompanyId ?? ""}/billing-rates`;
    const canViewBillingRates = hasAnyPermission(permissions, BILLING_RATE_PERMISSIONS);

    const formatValue = (value: string | number | boolean | null | undefined) => {
        if (value === null || value === undefined || value === "") return "-";
        if (typeof value === "boolean") return value ? "Yes" : "No";
        return value;
    };

    const presetLocationCount = useMemo(() => {
        if (!client) return 0;
        return locations.filter((location) =>
            (location.prioritizedClientCompanyIds ?? []).includes(client.clientCompanyId)
        ).length;
    }, [locations, client]);

    const identityMetrics = useMemo(() => {
        if (!client) {
            return [
                { label: "Contacts", value: "0" },
                { label: "Preset locations", value: "0" },
            ];
        }
        return [
            { label: "Contacts", value: String((client.contacts ?? []).length) },
            { label: "Preset locations", value: String(presetLocationCount) },
        ];
    }, [client, presetLocationCount]);

    const openEditModal = () => {
        if (!client) return;
        setEditDraft(clientToDraft(client));
        setEditError(null);
        setEditOpen(true);
    };

    const closeEditModal = () => {
        if (editSaving) return;
        setEditOpen(false);
        setEditError(null);
    };

    const updateContact = (
        index: number,
        key: keyof PlanningClientCompanyContactSaveDTO,
        value: string
    ) => {
        setEditDraft((current) => ({
            ...current,
            contacts: (current.contacts ?? []).map((contact, contactIndex) =>
                contactIndex === index ? { ...contact, [key]: value } : contact
            ),
        }));
        if (editError) setEditError(null);
    };

    const addContactDraft = () => {
        setEditDraft((current) => ({
            ...current,
            contacts: [...(current.contacts ?? []), { ...EMPTY_CONTACT }],
        }));
        if (editError) setEditError(null);
    };

    const removeContactDraft = (index: number) => {
        setEditDraft((current) => ({
            ...current,
            contacts: (current.contacts ?? []).filter(
                (_, contactIndex) => contactIndex !== index
            ),
        }));
        if (editError) setEditError(null);
    };

    const handleSelectProfilePicture = async (file: File | null) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setEditError("Please select an image file.");
            return;
        }
        if (file.size > MAX_CLIENT_PROFILE_PICTURE_BYTES) {
            setEditError("Client profile picture must be 500KB or smaller.");
            return;
        }
        try {
            const dataUrl = await readFileAsDataUrl(file);
            setEditDraft((current) => ({ ...current, profilePictureUrl: dataUrl }));
            if (editError) setEditError(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not read profile picture.";
            setEditError(message);
        }
    };

    const removeProfilePicture = () => {
        setEditDraft((current) => ({ ...current, profilePictureUrl: null }));
        if (editError) setEditError(null);
    };

    const canSubmitEdit = Boolean(editDraft.name?.trim());

    const handleEditSave = async (event: FormEvent) => {
        event.preventDefault();
        if (!clientCompanyId) return;

        const payload: PlanningClientCompanySaveDTO = {
            name: editDraft.name?.trim() ?? "",
            address: editDraft.address?.trim() || null,
            companyLine: editDraft.companyLine?.trim() || null,
            notes: editDraft.notes?.trim() || null,
            profilePictureUrl: editDraft.profilePictureUrl || null,
            contacts: (editDraft.contacts ?? [])
                .map((contact) => ({
                    firstName: contact.firstName?.trim() || null,
                    lastName: contact.lastName?.trim() || null,
                    position: contact.position?.trim() || null,
                    email: contact.email?.trim() || null,
                    phone: contact.phone?.trim() || null,
                }))
                .filter(
                    (contact) =>
                        contact.firstName ||
                        contact.lastName ||
                        contact.position ||
                        contact.email ||
                        contact.phone
                ),
        };

        if (!payload.name) {
            setEditError("Client name is required.");
            return;
        }

        try {
            setEditSaving(true);
            setEditError(null);
            const updated = await UserServices.updatePlanningClient(clientCompanyId, payload);
            setClient(updated);
            setEditOpen(false);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not update client.";
            setEditError(message);
        } finally {
            setEditSaving(false);
        }
    };

    const openDeleteModal = () => {
        setDeleteError(null);
        setDeleteOpen(true);
    };

    const closeDeleteModal = () => {
        if (deleting) return;
        setDeleteOpen(false);
        setDeleteError(null);
    };

    const handleDelete = async () => {
        if (!clientCompanyId) return;
        try {
            setDeleting(true);
            setDeleteError(null);
            await UserServices.deletePlanningClient(clientCompanyId);
            setDeleteOpen(false);
            navigate("/management/clients");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not delete client.";
            setDeleteError(message);
        } finally {
            setDeleting(false);
        }
    };

    const renderShell = (children: ReactNode) => (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <div className="adminDashboardCard adminUserDetailsPage">{children}</div>
                    </div>
                </div>
            </div>
        </>
    );

    const renderHeaderActions = () => (
        <div className="adminUserDetailsHeaderActions">
            <button
                type="button"
                className="button buttonSecondary"
                onClick={openEditModal}
                disabled={!client || loading}
            >
                Edit client
            </button>
            <button
                type="button"
                className="button buttonDanger"
                onClick={openDeleteModal}
                disabled={!client || loading}
            >
                Delete client
            </button>
        </div>
    );

    if (loading) {
        return renderShell(
            <section className="adminUserDetailsHero">
                <div className="adminUserDetailsHeaderTop">
                    <div className="adminUserDetailsBackRow">
                        <PageBack to="/management/clients" preferTarget />
                        {renderHeaderActions()}
                    </div>
                    <div className="adminUserDetailsHeaderRow">
                        <div className="pageHeader adminUserDetailsHeader">
                            <h1 className="pageTitle">Client</h1>
                            <p className="pageSubtitle">
                                Profile, contacts, and locations in one consistent workspace.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="adminUserDetailsHeroState">
                    <Spinner text="Loading client" />
                </div>
            </section>
        );
    }

    if (error || !client) {
        return renderShell(
            <section className="adminUserDetailsHero">
                <div className="adminUserDetailsHeaderTop">
                    <div className="adminUserDetailsBackRow">
                        <PageBack to="/management/clients" preferTarget />
                        {renderHeaderActions()}
                    </div>
                    <div className="adminUserDetailsHeaderRow">
                        <div className="pageHeader adminUserDetailsHeader">
                            <h1 className="pageTitle">Client</h1>
                            <p className="pageSubtitle">
                                Profile, contacts, and locations in one consistent workspace.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="workHistoryError">{error ?? "Client not found."}</div>
            </section>
        );
    }

    const displayName = client.name?.trim() || "Client";
    const address = client.address?.trim();
    const companyLine = client.companyLine?.trim();

    return renderShell(
        <>
            <section className="adminUserDetailsHero">
                <div className="adminUserDetailsHeaderTop">
                    <div className="adminUserDetailsBackRow">
                        <PageBack to="/management/clients" preferTarget />
                        {renderHeaderActions()}
                    </div>
                    <div className="adminUserDetailsHeaderRow">
                        <div className="pageHeader adminUserDetailsHeader">
                            <h1 className="pageTitle">Client Details</h1>
                            <p className="pageSubtitle">
                                Profile, contacts, and locations in one consistent workspace.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="adminUserIdentity">
                    <div
                        className={`planningClientAvatar planningClientAvatar--large adminUserIdentityAvatar ${
                            client.profilePictureUrl ? "planningClientAvatar--image" : ""
                        }`}
                        aria-label="Client profile picture"
                    >
                        {client.profilePictureUrl ? (
                            <button
                                type="button"
                                className="profile_avatar_view_button"
                                onClick={() => setProfilePictureViewerOpen(true)}
                                aria-label={`View profile picture for ${displayName}`}
                            >
                                <img
                                    className="planningClientAvatarImage"
                                    src={client.profilePictureUrl}
                                    alt={`${displayName} profile`}
                                />
                                <span className="profile_avatar_view_hint">View</span>
                            </button>
                        ) : (
                            <span className="planningClientAvatarLetter">
                                {clientInitial(client.name)}
                            </span>
                        )}
                    </div>

                    <div className="adminUserIdentityMain">
                        <div className="adminUserIdentityNameRow">
                            <h2 className="adminUserIdentityName">{displayName}</h2>
                        </div>
                        {address ? (
                            <p className="adminUserIdentityEmail">{address}</p>
                        ) : null}
                        <div className="adminUserIdentityMeta">
                            {companyLine ? <span>{companyLine}</span> : null}
                            <span>
                                {(client.contacts ?? []).length} contact
                                {(client.contacts ?? []).length === 1 ? "" : "s"}
                            </span>
                        </div>
                    </div>

                    <div className="adminUserIdentityMetrics">
                        {identityMetrics.map((metric) => (
                            <div key={metric.label} className="adminUserIdentityMetric">
                                <div className="adminUserIdentityMetricLabel">{metric.label}</div>
                                <div className="adminUserIdentityMetricValue">{metric.value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <nav className="adminUserDetailsTabs" aria-label="Client detail tabs">
                    <NavLink
                        to={detailRoot}
                        end
                        className={({ isActive }) =>
                            `adminUserDetailsTab ${isActive ? "adminUserDetailsTab--active" : ""}`
                        }
                    >
                        General information
                    </NavLink>
                    <NavLink
                        to={detailLocations}
                        className={({ isActive }) =>
                            `adminUserDetailsTab ${isActive ? "adminUserDetailsTab--active" : ""}`
                        }
                    >
                        Locations
                    </NavLink>
                    {canViewBillingRates ? (
                        <NavLink
                            to={detailBillingRates}
                            className={({ isActive }) =>
                                `adminUserDetailsTab ${isActive ? "adminUserDetailsTab--active" : ""}`
                            }
                        >
                            Billing rates
                        </NavLink>
                    ) : null}
                </nav>
            </section>

            <section className="adminUserDetailsTabPanel">
                <Outlet
                    context={{
                        client,
                        formatValue,
                    }}
                />
            </section>

            <Modal
                open={editOpen}
                onClose={closeEditModal}
                title="Edit client"
                maxHeight={680}
                height={680}
                hideDefaultFooter
                closeOnEscape={false}
                closeOnOverlayClick={false}
            >
                <form className="roleWizard" onSubmit={(event) => void handleEditSave(event)}>
                    <div className="roleWizardPanel planningClientModalPanel">
                        <div className="planningClientSectionHeader">
                            <span className="planningClientSectionTitle">Details</span>
                        </div>

                        <div className="planningClientPictureEditor">
                            <div
                                className={`planningClientAvatar planningClientAvatar--large ${
                                    editDraft.profilePictureUrl ? "planningClientAvatar--image" : ""
                                }`}
                                aria-label="Client profile picture preview"
                            >
                                {editDraft.profilePictureUrl ? (
                                    <img
                                        className="planningClientAvatarImage"
                                        src={editDraft.profilePictureUrl}
                                        alt="Client profile preview"
                                    />
                                ) : (
                                    <span className="planningClientAvatarLetter">
                                        {clientInitial(editDraft.name)}
                                    </span>
                                )}
                            </div>
                            <div className="planningClientPictureActions">
                                <label className="buttonSecondary planningClientPictureButton">
                                    {editDraft.profilePictureUrl ? "Change picture" : "Upload picture"}
                                    <input
                                        className="planningClientPictureInput"
                                        type="file"
                                        accept="image/*"
                                        onChange={(event) =>
                                            void handleSelectProfilePicture(
                                                event.target.files?.[0] ?? null
                                            )
                                        }
                                        disabled={editSaving}
                                    />
                                </label>
                                {editDraft.profilePictureUrl ? (
                                    <button
                                        type="button"
                                        className="buttonSecondary planningClientPictureButton"
                                        onClick={removeProfilePicture}
                                        disabled={editSaving}
                                    >
                                        Remove picture
                                    </button>
                                ) : (
                                    <span className="roleWizardMeta">
                                        PNG, JPG, WEBP up to 500KB.
                                    </span>
                                )}
                            </div>
                        </div>

                        <label className="roleWizardField">
                            <span className="roleWizardLabel">Name</span>
                            <input
                                className="modal_input"
                                value={editDraft.name ?? ""}
                                onChange={(event) => {
                                    setEditDraft((current) => ({
                                        ...current,
                                        name: event.target.value,
                                    }));
                                    if (editError) setEditError(null);
                                }}
                                placeholder="Example: Festival Breda"
                                disabled={editSaving}
                            />
                        </label>

                        <label className="roleWizardField">
                            <span className="roleWizardLabel">Address</span>
                            <input
                                className="modal_input"
                                value={editDraft.address ?? ""}
                                onChange={(event) => {
                                    setEditDraft((current) => ({
                                        ...current,
                                        address: event.target.value,
                                    }));
                                    if (editError) setEditError(null);
                                }}
                                placeholder="Street, city, postal code"
                                disabled={editSaving}
                            />
                        </label>

                        <label className="roleWizardField">
                            <span className="roleWizardLabel">Company line</span>
                            <input
                                className="modal_input"
                                value={editDraft.companyLine ?? ""}
                                onChange={(event) => {
                                    setEditDraft((current) => ({
                                        ...current,
                                        companyLine: event.target.value,
                                    }));
                                    if (editError) setEditError(null);
                                }}
                                placeholder="Optional company line"
                                disabled={editSaving}
                            />
                        </label>

                        <div className="planningClientSectionHeader">
                            <span className="planningClientSectionTitle">Contacts</span>
                            <span className="roleWizardMeta">
                                {editDraft.contacts?.length ?? 0} added
                            </span>
                        </div>

                        {editDraft.contacts?.length ? (
                            <div className="planningClientDraftList">
                                {editDraft.contacts.map((contact, index) => (
                                    <div key={index} className="planningClientDraftCard">
                                        <div className="planningClientDraftGrid">
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">First name</span>
                                                <input
                                                    className="modal_input"
                                                    value={contact.firstName ?? ""}
                                                    onChange={(event) =>
                                                        updateContact(
                                                            index,
                                                            "firstName",
                                                            event.target.value
                                                        )
                                                    }
                                                    disabled={editSaving}
                                                />
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Last name</span>
                                                <input
                                                    className="modal_input"
                                                    value={contact.lastName ?? ""}
                                                    onChange={(event) =>
                                                        updateContact(
                                                            index,
                                                            "lastName",
                                                            event.target.value
                                                        )
                                                    }
                                                    disabled={editSaving}
                                                />
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Position</span>
                                                <input
                                                    className="modal_input"
                                                    value={contact.position ?? ""}
                                                    onChange={(event) =>
                                                        updateContact(
                                                            index,
                                                            "position",
                                                            event.target.value
                                                        )
                                                    }
                                                    disabled={editSaving}
                                                />
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Email</span>
                                                <input
                                                    className="modal_input"
                                                    value={contact.email ?? ""}
                                                    onChange={(event) =>
                                                        updateContact(
                                                            index,
                                                            "email",
                                                            event.target.value
                                                        )
                                                    }
                                                    disabled={editSaving}
                                                />
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Phone</span>
                                                <input
                                                    className="modal_input"
                                                    value={contact.phone ?? ""}
                                                    onChange={(event) =>
                                                        updateContact(
                                                            index,
                                                            "phone",
                                                            event.target.value
                                                        )
                                                    }
                                                    disabled={editSaving}
                                                />
                                            </label>
                                        </div>
                                        <button
                                            type="button"
                                            className="roleWizardUserRemove planningClientRemoveContact"
                                            onClick={() => removeContactDraft(index)}
                                            disabled={editSaving}
                                        >
                                            Remove contact
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="roleWizardMeta">No contacts added yet.</div>
                        )}

                        <button
                            type="button"
                            className="buttonSecondary planningClientAddContact"
                            onClick={addContactDraft}
                            disabled={editSaving}
                        >
                            Add contact
                        </button>

                        <div className="planningClientSectionHeader">
                            <span className="planningClientSectionTitle">Notes</span>
                        </div>

                        <label className="roleWizardField">
                            <span className="roleWizardLabel">Notes</span>
                            <textarea
                                className="modal_input planningClientNotesInput"
                                value={editDraft.notes ?? ""}
                                onChange={(event) => {
                                    setEditDraft((current) => ({
                                        ...current,
                                        notes: event.target.value,
                                    }));
                                    if (editError) setEditError(null);
                                }}
                                placeholder="Optional notes about this client"
                                disabled={editSaving}
                            />
                        </label>
                    </div>

                    {editError ? (
                        <div className="roleWizardAlert roleWizardAlert--error">{editError}</div>
                    ) : null}

                    <div className="roleWizardActions planningClientWizardActions">
                        <button
                            type="button"
                            className="buttonSecondary planningClientCancel"
                            onClick={closeEditModal}
                            disabled={editSaving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="roleWizardPrimary"
                            disabled={!canSubmitEdit || editSaving}
                        >
                            {editSaving ? "Saving..." : "Save changes"}
                        </button>
                    </div>
                </form>
            </Modal>

            <Modal
                open={deleteOpen}
                onClose={closeDeleteModal}
                title="Delete client"
                hideDefaultFooter
                maxHeight={420}
            >
                <div className="planningClientDeletePrompt">
                    <p className="planningClientDeleteText">
                        Delete <strong>{displayName}</strong> permanently?
                    </p>
                    <p className="planningClientDeleteWarning">
                        This removes the client and any saved-location priorities for them. Projects
                        already linked to this client must be removed or reassigned first.
                    </p>
                    {deleteError ? (
                        <div className="roleWizardAlert roleWizardAlert--error">{deleteError}</div>
                    ) : null}
                    <div className="planningClientDeleteActions">
                        <button
                            type="button"
                            className="buttonSecondary"
                            onClick={closeDeleteModal}
                            disabled={deleting}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="buttonDanger"
                            onClick={() => void handleDelete()}
                            disabled={deleting}
                        >
                            {deleting ? "Deleting..." : "Delete client"}
                        </button>
                    </div>
                </div>
            </Modal>

            <ProfilePictureViewer
                open={profilePictureViewerOpen}
                src={client.profilePictureUrl ?? null}
                alt={`${displayName} profile picture`}
                downloadName={`${(displayName || "client").trim().toLowerCase().replace(/\s+/g, "-")}-profile-picture.jpg`}
                onClose={() => setProfilePictureViewerOpen(false)}
            />
        </>
    );
}
