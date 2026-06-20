import { useCallback, useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import PaginationControls from "../components/common/PaginationControls";
import { FilterPanelBody, FilterToggleButton } from "../components/common/FilterPanel";
import type { FilterFieldConfig } from "../components/common/FilterPanel.types";
import { useFilterPanel } from "../components/common/useFilterPanel";
import { applyFilterRows, textIncludes } from "../utils/applyFilterRows";
import {
    UserServices,
    type PlanningClientCompanyContactSaveDTO,
    type PlanningClientCompanyDTO,
    type PlanningClientCompanySaveDTO,
} from "../services/user-service/UserServices";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminUsers.css";
import "../stylesheets/AdminPlanningClients.css";
import "../stylesheets/Settings.css";

const FILTER_FIELDS: FilterFieldConfig[] = [
    {
        field: "search",
        label: "Search",
        section: "Identity",
        placeholder: "Name, contact, address",
        kind: { kind: "search" },
    },
    {
        field: "name",
        label: "Client name",
        section: "Identity",
        kind: { kind: "text" },
    },
    {
        field: "address",
        label: "Address",
        section: "Location",
        kind: { kind: "text" },
    },
    {
        field: "companyLine",
        label: "Company line",
        section: "Identity",
        kind: { kind: "text" },
    },
    {
        field: "contact",
        label: "Contact name",
        section: "Contacts",
        placeholder: "Contact name, email or phone",
        kind: { kind: "text" },
    },
    {
        field: "notes",
        label: "Notes contain",
        section: "Notes",
        kind: { kind: "text" },
    },
];

const EMPTY_CONTACT: PlanningClientCompanyContactSaveDTO = {
    firstName: "",
    lastName: "",
    position: "",
    email: "",
    phone: "",
};

const MAX_CLIENT_PROFILE_PICTURE_BYTES = 500_000;
const DEFAULT_PAGE_SIZE = 50;

function SuccessCheckIcon() {
    return (
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="10" cy="10" r="8" fill="currentColor" opacity="0.16" />
            <path d="M6.4 10.3l2.2 2.2 5-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
        </svg>
    );
}

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

export default function AdminPlanningClients() {
    const navigate = useNavigate();
    const [clients, setClients] = useState<PlanningClientCompanyDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const filter = useFilterPanel({ fields: FILTER_FIELDS });
    const [createClientOpen, setCreateClientOpen] = useState(false);
    const [createSaveError, setCreateSaveError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [totalClients, setTotalClients] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [clientDraft, setClientDraft] = useState<PlanningClientCompanySaveDTO>({
        name: "",
        address: "",
        companyLine: "",
        notes: "",
        profilePictureUrl: null,
        contacts: [],
    });

    const loadClients = useCallback(async (targetPage = page, targetPageSize = pageSize) => {
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getPlanningClientsPage(targetPage, targetPageSize);
            setClients(data.items);
            setPage(data.page);
            setTotalClients(data.totalElements);
            setTotalPages(data.totalPages);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load client companies.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize]);

    useEffect(() => {
        void loadClients();
    }, [loadClients]);

    useEffect(() => {
        if (!saveSuccess) return;
        const timeoutId = window.setTimeout(() => setSaveSuccess(null), 3200);
        return () => window.clearTimeout(timeoutId);
    }, [saveSuccess]);

    const filteredClients = useMemo(() => {
        const contactBlob = (client: PlanningClientCompanyDTO) =>
            client.contacts
                .flatMap((contact) => [
                    contact.firstName,
                    contact.lastName,
                    contact.position,
                    contact.email,
                    contact.phone,
                ])
                .filter(Boolean)
                .join(" ");

        return applyFilterRows(clients, filter.rows, {
            search: (client, value) => {
                const haystack = [
                    client.name,
                    client.address,
                    client.companyLine,
                    client.notes,
                    contactBlob(client),
                ]
                    .filter(Boolean)
                    .join(" ");
                return textIncludes(haystack, value);
            },
            name: (client, value) => textIncludes(client.name, value),
            address: (client, value) => textIncludes(client.address, value),
            companyLine: (client, value) => textIncludes(client.companyLine, value),
            contact: (client, value) => textIncludes(contactBlob(client), value),
            notes: (client, value) => textIncludes(client.notes, value),
        });
    }, [clients, filter.rows]);

    const resetCreateClientForm = useCallback(() => {
        setCreateSaveError(null);
        setClientDraft({
            name: "",
            address: "",
            companyLine: "",
            notes: "",
            profilePictureUrl: null,
            contacts: [],
        });
    }, []);

    const openCreateClientModal = () => {
        resetCreateClientForm();
        setCreateClientOpen(true);
    };

    const closeCreateClientModal = () => {
        if (saving) return;
        setCreateClientOpen(false);
        resetCreateClientForm();
    };

    const openClientDetail = (client: PlanningClientCompanyDTO) => {
        navigate(`/management/clients/${client.clientCompanyId}`);
    };

    const handleClientRowKeyDown = (
        event: KeyboardEvent<HTMLDivElement>,
        client: PlanningClientCompanyDTO
    ) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openClientDetail(client);
        }
    };

    const updateContact = (index: number, key: keyof PlanningClientCompanyContactSaveDTO, value: string) => {
        setClientDraft((current) => ({
            ...current,
            contacts: (current.contacts ?? []).map((contact, contactIndex) =>
                contactIndex === index ? { ...contact, [key]: value } : contact
            ),
        }));
        if (createSaveError) setCreateSaveError(null);
    };

    const addContactDraft = () => {
        setClientDraft((current) => ({
            ...current,
            contacts: [...(current.contacts ?? []), { ...EMPTY_CONTACT }],
        }));
        if (createSaveError) setCreateSaveError(null);
    };

    const removeContactDraft = (index: number) => {
        setClientDraft((current) => ({
            ...current,
            contacts: (current.contacts ?? []).filter((_, contactIndex) => contactIndex !== index),
        }));
        if (createSaveError) setCreateSaveError(null);
    };

    const handleSelectClientProfilePicture = async (file: File | null) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setCreateSaveError("Please select an image file.");
            return;
        }
        if (file.size > MAX_CLIENT_PROFILE_PICTURE_BYTES) {
            setCreateSaveError("Client profile picture must be 500KB or smaller.");
            return;
        }

        try {
            const dataUrl = await readFileAsDataUrl(file);
            setClientDraft((current) => ({ ...current, profilePictureUrl: dataUrl }));
            if (createSaveError) setCreateSaveError(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not read profile picture.";
            setCreateSaveError(message);
        }
    };

    const removeClientProfilePicture = () => {
        setClientDraft((current) => ({ ...current, profilePictureUrl: null }));
        if (createSaveError) setCreateSaveError(null);
    };

    const handleCreate = async (event: FormEvent) => {
        event.preventDefault();

        const payload: PlanningClientCompanySaveDTO = {
            name: clientDraft.name?.trim() ?? "",
            address: clientDraft.address?.trim() || null,
            companyLine: clientDraft.companyLine?.trim() || null,
            notes: clientDraft.notes?.trim() || null,
            profilePictureUrl: clientDraft.profilePictureUrl || null,
            contacts: (clientDraft.contacts ?? [])
                .map((contact) => ({
                    firstName: contact.firstName?.trim() || null,
                    lastName: contact.lastName?.trim() || null,
                    position: contact.position?.trim() || null,
                    email: contact.email?.trim() || null,
                    phone: contact.phone?.trim() || null,
                }))
                .filter((contact) =>
                    contact.firstName || contact.lastName || contact.position || contact.email || contact.phone
                ),
        };

        if (!payload.name) {
            setCreateSaveError("Client name is required.");
            return;
        }

        try {
            setSaving(true);
            setCreateSaveError(null);
            setSaveSuccess(null);
            await UserServices.createPlanningClient(payload);
            await loadClients(0);
            setCreateClientOpen(false);
            resetCreateClientForm();
            setSaveSuccess("Client added.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not create client.";
            setCreateSaveError(message);
        } finally {
            setSaving(false);
        }
    };

    const canSubmitCreate = Boolean(clientDraft.name?.trim());

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="pageHeader">
                            <PageBack to="/management" />
                            <h1 className="pageTitle">Clients</h1>
                            <p className="pageSubtitle">
                                Manage the client companies and contacts used for planning.
                            </p>
                        </header>

                        <div className="adminDashboardCard">
                            <Card
                                title="Client"
                                right={(
                                    <div className="adminUsersToolbar">
                                        <div className="adminUsersCount">
                                            {filteredClients.length} of {clients.length} on this page | {totalClients} total
                                        </div>
                                        <FilterToggleButton controller={filter} />
                                        <button
                                            type="button"
                                            className="button"
                                            onClick={openCreateClientModal}
                                            disabled={loading || saving}
                                        >
                                            Add client
                                        </button>
                                    </div>
                                )}
                            >
                                <FilterPanelBody
                                    controller={filter}
                                    resultMeta={`${filteredClients.length} of ${clients.length} on this page`}
                                />
                                <div className="listContainer">
                                    <div className="planningClientTableFrame">
                                        <div className="planningClientTable">
                                            <div className="listHeaderGrid gridPlanningClients">
                                                <div className="planningClientHeaderCell planningClientHeaderCell--identity">
                                                    <span className="planningClientAvatarSpacer" aria-hidden="true" />
                                                    <span>Name</span>
                                                </div>
                                                <div className="planningClientHeaderCell">
                                                    <span>Address</span>
                                                </div>
                                                <div className="planningClientHeaderCell">
                                                    <span>Company line</span>
                                                </div>
                                            </div>
                                            <div className="listScrollArea adminUsersScroll planningClientListScroll">
                                                {loading ? <div className="listEmpty">Loading clients...</div> : null}
                                                {error ? <div className="listEmpty errorText">{error}</div> : null}
                                                {!loading && !error && filteredClients.length === 0 ? (
                                                    <div className="listEmpty">No client companies found.</div>
                                                ) : null}

                                                {!loading && !error
                                                    ? filteredClients.map((client) => (
                                                        <div
                                                            key={client.clientCompanyId}
                                                            className="listRowGrid gridPlanningClients planningClientRow planningClientRowButton"
                                                            role="button"
                                                            tabIndex={0}
                                                            onClick={() => openClientDetail(client)}
                                                            onKeyDown={(event) => handleClientRowKeyDown(event, client)}
                                                        >
                                                            <div className="cellMain planningClientCell planningClientIdentityCell">
                                                                <div
                                                                    className={`planningClientAvatar ${
                                                                        client.profilePictureUrl ? "planningClientAvatar--image" : ""
                                                                    }`}
                                                                    aria-hidden="true"
                                                                >
                                                                    {client.profilePictureUrl ? (
                                                                        <img
                                                                            className="planningClientAvatarImage"
                                                                            src={client.profilePictureUrl}
                                                                            alt=""
                                                                        />
                                                                    ) : (
                                                                        <span className="planningClientAvatarLetter">{clientInitial(client.name)}</span>
                                                                    )}
                                                                </div>
                                                                <span className="planningClientNameText planningClientCellValue">{client.name}</span>
                                                            </div>
                                                            <div className="cellSub planningClientCell">
                                                                <span className="planningClientCellValue">{client.address || "—"}</span>
                                                            </div>
                                                            <div className="cellSub planningClientCell">
                                                                <span className="planningClientCellValue">{client.companyLine || "—"}</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                    : null}
                                            </div>
                                        </div>
                                    </div>
                                    <PaginationControls
                                        page={page}
                                        totalPages={totalPages}
                                        pageSize={pageSize}
                                        loading={loading}
                                        onPageChange={(nextPage) => void loadClients(nextPage)}
                                        onPageSizeChange={(nextPageSize) => {
                                            setPageSize(nextPageSize);
                                            setPage(0);
                                            void loadClients(0, nextPageSize);
                                        }}
                                    />
                                </div>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>

            {saveSuccess ? (
                <div className="planningClientToast" role="status" aria-live="polite">
                    <span className="planningClientToastIcon">
                        <SuccessCheckIcon />
                    </span>
                    <div className="planningClientToastBody">
                        <span className="planningClientToastTitle">Client saved</span>
                        <span className="planningClientToastMessage">{saveSuccess}</span>
                    </div>
                </div>
            ) : null}

            <Modal
                open={createClientOpen}
                onClose={closeCreateClientModal}
                title="Add client"
                maxHeight={680}
                height={680}
                hideDefaultFooter
                closeOnEscape={false}
                closeOnOverlayClick={false}
            >
                <form className="roleWizard" onSubmit={(event) => void handleCreate(event)}>
                    <div className="roleWizardPanel planningClientModalPanel">
                        <div className="planningClientSectionHeader">
                            <span className="planningClientSectionTitle">Details</span>
                        </div>

                        <div className="planningClientPictureEditor">
                            <div
                                className={`planningClientAvatar planningClientAvatar--large ${
                                    clientDraft.profilePictureUrl ? "planningClientAvatar--image" : ""
                                }`}
                                aria-label="Client profile picture preview"
                            >
                                {clientDraft.profilePictureUrl ? (
                                    <img
                                        className="planningClientAvatarImage"
                                        src={clientDraft.profilePictureUrl}
                                        alt="Client profile preview"
                                    />
                                ) : (
                                    <span className="planningClientAvatarLetter">{clientInitial(clientDraft.name)}</span>
                                )}
                            </div>
                            <div className="planningClientPictureActions">
                                <label className="buttonSecondary planningClientPictureButton">
                                    {clientDraft.profilePictureUrl ? "Change picture" : "Upload picture"}
                                    <input
                                        className="planningClientPictureInput"
                                        type="file"
                                        accept="image/*"
                                        onChange={(event) =>
                                            void handleSelectClientProfilePicture(event.target.files?.[0] ?? null)
                                        }
                                        disabled={saving}
                                    />
                                </label>
                                {clientDraft.profilePictureUrl ? (
                                    <button
                                        type="button"
                                        className="buttonSecondary planningClientPictureButton"
                                        onClick={removeClientProfilePicture}
                                        disabled={saving}
                                    >
                                        Remove picture
                                    </button>
                                ) : (
                                    <span className="roleWizardMeta">PNG, JPG, WEBP up to 500KB.</span>
                                )}
                            </div>
                        </div>

                        <label className="roleWizardField">
                            <span className="roleWizardLabel">Name</span>
                            <input
                                className="modal_input"
                                value={clientDraft.name ?? ""}
                                onChange={(event) => {
                                    setClientDraft((current) => ({ ...current, name: event.target.value }));
                                    if (createSaveError) setCreateSaveError(null);
                                }}
                                placeholder="Example: Festival Breda"
                                disabled={saving}
                            />
                        </label>

                        <label className="roleWizardField">
                            <span className="roleWizardLabel">Address</span>
                            <input
                                className="modal_input"
                                value={clientDraft.address ?? ""}
                                onChange={(event) => {
                                    setClientDraft((current) => ({ ...current, address: event.target.value }));
                                    if (createSaveError) setCreateSaveError(null);
                                }}
                                placeholder="Street, city, postal code"
                                disabled={saving}
                            />
                        </label>

                        <label className="roleWizardField">
                            <span className="roleWizardLabel">Company line</span>
                            <input
                                className="modal_input"
                                value={clientDraft.companyLine ?? ""}
                                onChange={(event) => {
                                    setClientDraft((current) => ({ ...current, companyLine: event.target.value }));
                                    if (createSaveError) setCreateSaveError(null);
                                }}
                                placeholder="Optional company line"
                                disabled={saving}
                            />
                        </label>

                        <div className="planningClientSectionHeader">
                            <span className="planningClientSectionTitle">Contacts</span>
                            <span className="roleWizardMeta">{clientDraft.contacts?.length ?? 0} added</span>
                        </div>

                        {clientDraft.contacts?.length ? (
                            <div className="planningClientDraftList">
                                {clientDraft.contacts.map((contact, index) => (
                                    <div key={index} className="planningClientDraftCard">
                                        <div className="planningClientDraftGrid">
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">First name</span>
                                                <input
                                                    className="modal_input"
                                                    value={contact.firstName ?? ""}
                                                    onChange={(event) => updateContact(index, "firstName", event.target.value)}
                                                    disabled={saving}
                                                />
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Last name</span>
                                                <input
                                                    className="modal_input"
                                                    value={contact.lastName ?? ""}
                                                    onChange={(event) => updateContact(index, "lastName", event.target.value)}
                                                    disabled={saving}
                                                />
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Position</span>
                                                <input
                                                    className="modal_input"
                                                    value={contact.position ?? ""}
                                                    onChange={(event) => updateContact(index, "position", event.target.value)}
                                                    disabled={saving}
                                                />
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Email</span>
                                                <input
                                                    className="modal_input"
                                                    value={contact.email ?? ""}
                                                    onChange={(event) => updateContact(index, "email", event.target.value)}
                                                    disabled={saving}
                                                />
                                            </label>
                                            <label className="roleWizardField">
                                                <span className="roleWizardLabel">Phone</span>
                                                <input
                                                    className="modal_input"
                                                    value={contact.phone ?? ""}
                                                    onChange={(event) => updateContact(index, "phone", event.target.value)}
                                                    disabled={saving}
                                                />
                                            </label>
                                        </div>
                                        <button
                                            type="button"
                                            className="roleWizardUserRemove planningClientRemoveContact"
                                            onClick={() => removeContactDraft(index)}
                                            disabled={saving}
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
                            disabled={saving}
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
                                value={clientDraft.notes ?? ""}
                                onChange={(event) => {
                                    setClientDraft((current) => ({ ...current, notes: event.target.value }));
                                    if (createSaveError) setCreateSaveError(null);
                                }}
                                placeholder="Optional notes about this client"
                                disabled={saving}
                            />
                        </label>

                        <div className="planningClientSummary">
                            <span className="planningClientSummaryLabel">Ready to add</span>
                            <span className="planningClientSummaryValue">{clientDraft.name?.trim() || "Unnamed client"}</span>
                            <span className="roleWizardMeta">
                                {clientDraft.contacts?.length ? `${clientDraft.contacts.length} contact(s) prepared` : "No contacts added"}
                            </span>
                        </div>
                    </div>

                    {createSaveError ? (
                        <div className="roleWizardAlert roleWizardAlert--error">{createSaveError}</div>
                    ) : null}

                    <div className="roleWizardActions planningClientWizardActions">
                        <button
                            type="button"
                            className="buttonSecondary planningClientCancel"
                            onClick={closeCreateClientModal}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="roleWizardPrimary"
                            disabled={!canSubmitCreate || saving}
                        >
                            {saving ? "Adding..." : "Add client"}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
