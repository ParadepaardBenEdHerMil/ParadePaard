import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import {
    UserServices,
    type PlanningClientCompanyContactDTO,
    type PlanningClientCompanyContactSaveDTO,
    type PlanningClientCompanyDTO,
    type PlanningClientCompanySaveDTO,
} from "../services/user-service/UserServices";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminUsers.css";
import "../stylesheets/AdminPlanningClients.css";
import "../stylesheets/Settings.css";

type ClientCreateStep = "details" | "contacts" | "notes";

const EMPTY_CONTACT: PlanningClientCompanyContactSaveDTO = {
    firstName: "",
    lastName: "",
    position: "",
    email: "",
    phone: "",
};

function SuccessCheckIcon() {
    return (
        <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
            <circle cx="10" cy="10" r="8" fill="currentColor" opacity="0.16" />
            <path d="M6.4 10.3l2.2 2.2 5-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
        </svg>
    );
}

function contactDisplayName(contact: PlanningClientCompanyContactDTO): string {
    const parts = [contact.firstName?.trim(), contact.lastName?.trim()].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Unnamed contact";
}

export default function AdminPlanningClients() {
    const [clients, setClients] = useState<PlanningClientCompanyDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [createClientOpen, setCreateClientOpen] = useState(false);
    const [createStep, setCreateStep] = useState<ClientCreateStep>("details");
    const [clientDraft, setClientDraft] = useState<PlanningClientCompanySaveDTO>({
        name: "",
        address: "",
        companyLine: "",
        notes: "",
        contacts: [],
    });

    const loadClients = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getPlanningClients();
            setClients(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load client companies.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadClients();
    }, [loadClients]);

    useEffect(() => {
        if (!saveSuccess) return;
        const timeoutId = window.setTimeout(() => setSaveSuccess(null), 3200);
        return () => window.clearTimeout(timeoutId);
    }, [saveSuccess]);

    const filteredClients = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return clients;

        return clients.filter((client) => {
            const contactText = client.contacts
                .flatMap((contact) => [
                    contact.firstName,
                    contact.lastName,
                    contact.position,
                    contact.email,
                    contact.phone,
                ])
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return [
                client.name,
                client.address,
                client.companyLine,
                client.notes,
                contactText,
            ]
                .filter(Boolean)
                .some((value) => value!.toLowerCase().includes(term));
        });
    }, [clients, searchTerm]);

    const resetCreateClientForm = useCallback(() => {
        setCreateStep("details");
        setSaveError(null);
        setClientDraft({
            name: "",
            address: "",
            companyLine: "",
            notes: "",
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

    const updateContact = (index: number, key: keyof PlanningClientCompanyContactSaveDTO, value: string) => {
        setClientDraft((current) => ({
            ...current,
            contacts: (current.contacts ?? []).map((contact, contactIndex) =>
                contactIndex === index ? { ...contact, [key]: value } : contact
            ),
        }));
        if (saveError) setSaveError(null);
    };

    const addContactDraft = () => {
        setClientDraft((current) => ({
            ...current,
            contacts: [...(current.contacts ?? []), { ...EMPTY_CONTACT }],
        }));
        if (saveError) setSaveError(null);
    };

    const removeContactDraft = (index: number) => {
        setClientDraft((current) => ({
            ...current,
            contacts: (current.contacts ?? []).filter((_, contactIndex) => contactIndex !== index),
        }));
        if (saveError) setSaveError(null);
    };

    const handleCreate = async (event: FormEvent) => {
        event.preventDefault();

        const payload: PlanningClientCompanySaveDTO = {
            name: clientDraft.name?.trim() ?? "",
            address: clientDraft.address?.trim() || null,
            companyLine: clientDraft.companyLine?.trim() || null,
            notes: clientDraft.notes?.trim() || null,
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
            setSaveError("Client name is required.");
            return;
        }

        try {
            setSaving(true);
            setSaveError(null);
            setSaveSuccess(null);
            const created = await UserServices.createPlanningClient(payload);
            setClients((current) => [...current, created].sort((left, right) => left.name.localeCompare(right.name)));
            setCreateClientOpen(false);
            resetCreateClientForm();
            setSaveSuccess("Client added.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not create client.";
            setSaveError(message);
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
                                            {filteredClients.length} of {clients.length}
                                        </div>
                                        <input
                                            className="adminUsersSearchInput"
                                            type="search"
                                            placeholder="Search clients or contacts"
                                            value={searchTerm}
                                            onChange={(event) => setSearchTerm(event.target.value)}
                                            disabled={loading}
                                        />
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
                                <div className="listContainer">
                                    <div className="listHeaderGrid gridPlanningClients">
                                        <div>Name</div>
                                        <div>Address</div>
                                        <div>Company line</div>
                                        <div>Notes</div>
                                        <div>Contacts</div>
                                    </div>
                                    <div className="listScrollArea adminUsersScroll">
                                        {loading ? <div className="listEmpty">Loading clients...</div> : null}
                                        {error ? <div className="listEmpty errorText">{error}</div> : null}
                                        {!loading && !error && filteredClients.length === 0 ? (
                                            <div className="listEmpty">No client companies found.</div>
                                        ) : null}

                                        {!loading && !error
                                            ? filteredClients.map((client) => (
                                                <div key={client.clientCompanyId} className="listRowGrid gridPlanningClients planningClientRow">
                                                    <div className="cellMain planningClientCell">{client.name}</div>
                                                    <div className="cellSub planningClientCell">{client.address || "—"}</div>
                                                    <div className="cellSub planningClientCell">{client.companyLine || "—"}</div>
                                                    <div className="cellSub planningClientCell planningClientNotesCell">{client.notes || "—"}</div>
                                                    <div className="planningClientContactsCell">
                                                        {client.contacts.length === 0 ? (
                                                            <div className="planningClientContactsEmpty">No contacts</div>
                                                        ) : (
                                                            client.contacts.map((contact, index) => (
                                                                <div key={`${client.clientCompanyId}-${index}`} className="planningClientContactCard">
                                                                    <div className="planningClientContactName">{contactDisplayName(contact)}</div>
                                                                    <div className="planningClientContactMeta">{contact.position || "No position"}</div>
                                                                    <div className="planningClientContactMeta">{contact.email || "No email"}</div>
                                                                    <div className="planningClientContactMeta">{contact.phone || "No phone"}</div>
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                            : null}
                                    </div>
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
                        <span className="planningClientToastTitle">Client added</span>
                        <span className="planningClientToastMessage">{saveSuccess}</span>
                    </div>
                </div>
            ) : null}

            <Modal
                open={createClientOpen}
                onClose={closeCreateClientModal}
                title="Add client"
                maxHeight={560}
                height={560}
                hideDefaultFooter
                closeOnEscape={false}
                closeOnOverlayClick={false}
            >
                <form className="roleWizard" onSubmit={(event) => void handleCreate(event)}>
                    <div className="roleWizardTabs" role="tablist" aria-label="Client setup steps">
                        <button
                            type="button"
                            className={`roleWizardTab ${createStep === "details" ? "roleWizardTab--active" : ""}`}
                            onClick={() => setCreateStep("details")}
                            role="tab"
                            aria-selected={createStep === "details"}
                            disabled={saving}
                        >
                            Details
                        </button>
                        <button
                            type="button"
                            className={`roleWizardTab ${createStep === "contacts" ? "roleWizardTab--active" : ""}`}
                            onClick={() => setCreateStep("contacts")}
                            role="tab"
                            aria-selected={createStep === "contacts"}
                            disabled={saving}
                        >
                            Contacts
                        </button>
                        <button
                            type="button"
                            className={`roleWizardTab ${createStep === "notes" ? "roleWizardTab--active" : ""}`}
                            onClick={() => setCreateStep("notes")}
                            role="tab"
                            aria-selected={createStep === "notes"}
                            disabled={saving}
                        >
                            Notes
                        </button>
                    </div>

                    {createStep === "details" ? (
                        <div className="roleWizardPanel">
                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Name</span>
                                <input
                                    className="modal_input"
                                    value={clientDraft.name ?? ""}
                                    onChange={(event) => {
                                        setClientDraft((current) => ({ ...current, name: event.target.value }));
                                        if (saveError) setSaveError(null);
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
                                        if (saveError) setSaveError(null);
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
                                        if (saveError) setSaveError(null);
                                    }}
                                    placeholder="Optional company line"
                                    disabled={saving}
                                />
                            </label>
                        </div>
                    ) : null}

                    {createStep === "contacts" ? (
                        <div className="roleWizardPanel">
                            <div className="roleWizardHeaderRow">
                                <span className="roleWizardLabel">Contacts</span>
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
                        </div>
                    ) : null}

                    {createStep === "notes" ? (
                        <div className="roleWizardPanel">
                            <label className="roleWizardField">
                                <span className="roleWizardLabel">Notes</span>
                                <textarea
                                    className="modal_input planningClientNotesInput"
                                    value={clientDraft.notes ?? ""}
                                    onChange={(event) => {
                                        setClientDraft((current) => ({ ...current, notes: event.target.value }));
                                        if (saveError) setSaveError(null);
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
                    ) : null}

                    {saveError ? (
                        <div className="roleWizardAlert roleWizardAlert--error">{saveError}</div>
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
