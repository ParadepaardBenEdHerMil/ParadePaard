import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type FormEvent,
    type KeyboardEvent,
} from "react";
import { Link, useOutletContext } from "react-router-dom";
import Card from "../components/common/Card";
import Modal from "../components/common/Modal";
import LocationClientsCell from "../components/planning/LocationClientsCell";
import LocationClientsPicker from "../components/planning/LocationClientsPicker";
import PlanningLocationAddressFields from "../components/planning/PlanningLocationAddressFields";
import {
    UserServices,
    type PlanningClientCompanyDTO,
    type PlanningLocationDTO,
    type PlanningLocationSaveDTO,
} from "../services/user-service/UserServices";
import {
    buildPlanningLocationAddressLines,
    buildPlanningLocationSearchText,
} from "../utils/planningLocationAddress";
import { LocationDeleteConfirmation } from "./AdminPlanningLocations";
import type { ClientDetailOutletContext } from "./AdminPlanningClientDetail";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminUsers.css";
import "../stylesheets/Settings.css";
import "../stylesheets/AdminPlanningLocations.css";

const EMPTY_LOCATION_DRAFT: PlanningLocationSaveDTO = {
    name: "",
    streetName: "",
    houseNumber: "",
    houseNumberSuffix: "",
    postalCode: "",
    city: "",
    notes: "",
    prioritizedClientCompanyIds: [],
};

function SuccessCheckIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M20 6 9 17l-5-5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function LocationPinIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M12 21s-6.5-5.4-6.5-10.2A6.5 6.5 0 0 1 12 4.3a6.5 6.5 0 0 1 6.5 6.5C18.5 15.6 12 21 12 21Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
            />
            <circle cx="12" cy="10.6" r="2.4" stroke="currentColor" strokeWidth="1.7" />
        </svg>
    );
}

export default function AdminPlanningClientLocations() {
    const { client } = useOutletContext<ClientDetailOutletContext>();
    const clientCompanyId = client.clientCompanyId;

    const [allClients, setAllClients] = useState<PlanningClientCompanyDTO[]>([]);
    const [locations, setLocations] = useState<PlanningLocationDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");

    const [editingLocation, setEditingLocation] = useState<PlanningLocationDTO | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [draft, setDraft] = useState<PlanningLocationSaveDTO>(EMPTY_LOCATION_DRAFT);

    const [deleteTarget, setDeleteTarget] = useState<PlanningLocationDTO | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const loadClients = useCallback(async () => {
        try {
            const data = await UserServices.getPlanningClients();
            setAllClients(data);
        } catch {
            setAllClients([]);
        }
    }, []);

    const loadLocations = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getPlanningLocations(clientCompanyId);
            setLocations(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load locations.";
            setError(message);
            setLocations([]);
        } finally {
            setLoading(false);
        }
    }, [clientCompanyId]);

    useEffect(() => {
        void loadClients();
    }, [loadClients]);

    useEffect(() => {
        void loadLocations();
    }, [loadLocations]);

    useEffect(() => {
        if (!saveSuccess) return;
        const timeoutId = window.setTimeout(() => setSaveSuccess(null), 3200);
        return () => window.clearTimeout(timeoutId);
    }, [saveSuccess]);

    const presetLocations = useMemo(
        () =>
            locations.filter((location) =>
                (location.prioritizedClientCompanyIds ?? []).includes(clientCompanyId)
            ),
        [locations, clientCompanyId]
    );

    const visibleLocations = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return presetLocations;
        return presetLocations.filter((location) =>
            [location.name, buildPlanningLocationSearchText(location), location.notes]
                .filter(Boolean)
                .some((value) => value!.toLowerCase().includes(term))
        );
    }, [presetLocations, searchTerm]);

    function resetDraft() {
        setDraft({
            ...EMPTY_LOCATION_DRAFT,
            prioritizedClientCompanyIds: [clientCompanyId],
        });
    }

    function openCreateModal() {
        setEditingLocation(null);
        resetDraft();
        setSaveError(null);
        setIsModalOpen(true);
    }

    function openEditModal(location: PlanningLocationDTO) {
        setEditingLocation(location);
        setDraft({
            name: location.name ?? "",
            streetName: location.streetName ?? "",
            houseNumber: location.houseNumber ?? "",
            houseNumberSuffix: location.houseNumberSuffix ?? "",
            postalCode: location.postalCode ?? "",
            city: location.city ?? "",
            notes: location.notes ?? "",
            prioritizedClientCompanyIds: location.prioritizedClientCompanyIds ?? [],
        });
        setSaveError(null);
        setIsModalOpen(true);
    }

    function closeModal() {
        if (saving) return;
        setIsModalOpen(false);
        setEditingLocation(null);
        setSaveError(null);
        resetDraft();
    }

    async function handleSave(event: FormEvent) {
        event.preventDefault();
        if (!draft.name?.trim()) {
            setSaveError("Location name is required.");
            return;
        }

        const payload: PlanningLocationSaveDTO = {
            name: draft.name.trim(),
            streetName: draft.streetName?.trim() || null,
            houseNumber: draft.houseNumber?.trim() || null,
            houseNumberSuffix: draft.houseNumberSuffix?.trim() || null,
            postalCode: draft.postalCode?.trim() || null,
            city: draft.city?.trim() || null,
            notes: draft.notes?.trim() || null,
            prioritizedClientCompanyIds: draft.prioritizedClientCompanyIds ?? [],
        };

        try {
            setSaving(true);
            setSaveError(null);
            if (editingLocation) {
                await UserServices.updatePlanningLocation(editingLocation.locationId, payload);
                setSaveSuccess("Location updated.");
            } else {
                await UserServices.createPlanningLocation(payload);
                setSaveSuccess("Location added.");
            }
            setIsModalOpen(false);
            setEditingLocation(null);
            await loadLocations();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to save location.";
            setSaveError(message);
        } finally {
            setSaving(false);
        }
    }

    function openDeletePrompt(location: PlanningLocationDTO) {
        setDeleteTarget(location);
        setDeleteError(null);
    }

    function closeDeletePrompt() {
        if (deleting) return;
        setDeleteTarget(null);
        setDeleteError(null);
    }

    async function handleDelete() {
        if (!deleteTarget) return;

        try {
            setDeleting(true);
            setDeleteError(null);
            await UserServices.deletePlanningLocation(deleteTarget.locationId);
            setSaveSuccess("Location deleted.");
            if (editingLocation?.locationId === deleteTarget.locationId) {
                setIsModalOpen(false);
                setEditingLocation(null);
            }
            setDeleteTarget(null);
            await loadLocations();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to delete location.";
            setDeleteError(message);
        } finally {
            setDeleting(false);
        }
    }

    function handleLocationRowKeyDown(
        event: KeyboardEvent<HTMLDivElement>,
        location: PlanningLocationDTO
    ) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openEditModal(location);
        }
    }

    const hasAnyLocations = presetLocations.length > 0;
    const showGrid = !loading && !error && visibleLocations.length > 0;
    const showEmpty = !loading && !error && visibleLocations.length === 0;

    return (
        <>
            <Card
                title="Preset locations"
                className="adminUserDetailsPanel"
                right={
                    <div className="adminUsersToolbar planningLocationsToolbar">
                        <span className="adminUsersCount">
                            {hasAnyLocations
                                ? `${visibleLocations.length} of ${presetLocations.length} shown`
                                : "No preset locations yet"}
                        </span>
                        <input
                            className="adminUsersSearchInput"
                            type="search"
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder="Search location, city, postal code, or notes"
                            disabled={loading}
                        />
                        <button
                            type="button"
                            className="button"
                            onClick={openCreateModal}
                            disabled={saving}
                        >
                            Add location
                        </button>
                        <Link to="/management/locations" className="buttonSecondary">
                            View all locations
                        </Link>
                    </div>
                }
            >
                {error ? <div className="planningLocationsError">{error}</div> : null}

                {!error ? (
                    <div className="listContainer planningLocationsListContainer clientLocationsListContainer">
                        <div className="listHeaderGrid gridPlanningLocations">
                            <div>Location</div>
                            <div>Address</div>
                            <div>Notes</div>
                            <div>Clients</div>
                            <div>Actions</div>
                        </div>
                        <div className="listScrollArea planningLocationsListScroll">
                            {loading ? (
                                <div className="planningLocationsState">Loading locations...</div>
                            ) : null}

                            {showEmpty ? (
                                <div className="planningLocationsEmpty">
                                    <span className="planningLocationsEmptyIcon">
                                        <LocationPinIcon />
                                    </span>
                                    <h3>
                                        {hasAnyLocations
                                            ? "No locations match this search"
                                            : "No preset locations for this client yet"}
                                    </h3>
                                    <p>
                                        {hasAnyLocations
                                            ? "Try a different search term."
                                            : "Add a reusable location for this client to speed up project and shift planning."}
                                    </p>
                                    {!hasAnyLocations ? (
                                        <button
                                            type="button"
                                            className="button"
                                            onClick={openCreateModal}
                                        >
                                            Add your first location
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}

                            {showGrid
                                ? visibleLocations.map((location) => {
                                      const addressLines = buildPlanningLocationAddressLines(location);
                                      const hasAddress = Boolean(addressLines.line1 || addressLines.line2);
                                      const hasNotes = Boolean(location.notes?.trim());

                                      return (
                                          <div
                                              key={location.locationId}
                                              className="listRowGrid gridPlanningLocations clickableRow planningLocationsRow"
                                              role="button"
                                              tabIndex={0}
                                              onClick={() => openEditModal(location)}
                                              onKeyDown={(event) =>
                                                  handleLocationRowKeyDown(event, location)
                                              }
                                          >
                                              <div className="planningLocationsCell planningLocationsCell--name">
                                                  <span className="cellMain">{location.name}</span>
                                              </div>
                                              <div
                                                  className={`planningLocationsCell planningLocationsCell--address${
                                                      hasAddress ? "" : " planningLocationsCell--muted"
                                                  }`}
                                              >
                                                  {hasAddress ? (
                                                      <>
                                                          {addressLines.line1 ? (
                                                              <span className="planningLocationsCellLine">
                                                                  {addressLines.line1}
                                                              </span>
                                                          ) : null}
                                                          {addressLines.line2 ? (
                                                              <span className="planningLocationsCellLine">
                                                                  {addressLines.line2}
                                                              </span>
                                                          ) : null}
                                                      </>
                                                  ) : (
                                                      <span className="planningLocationsCellLine">
                                                          No address added
                                                      </span>
                                                  )}
                                              </div>
                                              <div
                                                  className={`planningLocationsCell planningLocationsCell--notes${
                                                      hasNotes ? "" : " planningLocationsCell--muted"
                                                  }`}
                                              >
                                                  <span className="planningLocationsCellLine">
                                                      {location.notes?.trim() || "No notes added"}
                                                  </span>
                                              </div>
                                              <LocationClientsCell
                                                  clientIds={location.prioritizedClientCompanyIds ?? []}
                                                  clients={allClients}
                                              />
                                              <div className="planningLocationsActions">
                                                  <button
                                                      type="button"
                                                      className="buttonSecondary"
                                                      onClick={(event) => {
                                                          event.stopPropagation();
                                                          openEditModal(location);
                                                      }}
                                                      disabled={saving}
                                                  >
                                                      Edit
                                                  </button>
                                                  <button
                                                      type="button"
                                                      className="buttonDanger"
                                                      onClick={(event) => {
                                                          event.stopPropagation();
                                                          openDeletePrompt(location);
                                                      }}
                                                      disabled={saving || deleting}
                                                  >
                                                      Delete
                                                  </button>
                                              </div>
                                          </div>
                                      );
                                  })
                                : null}
                        </div>
                    </div>
                ) : null}
            </Card>

            {saveSuccess ? (
                <div className="planningLocationsToast" role="status" aria-live="polite">
                    <span className="planningLocationsToastIcon">
                        <SuccessCheckIcon />
                    </span>
                    <div className="planningLocationsToastBody">
                        <span className="planningLocationsToastTitle">Locations updated</span>
                        <span className="planningLocationsToastMessage">{saveSuccess}</span>
                    </div>
                </div>
            ) : null}

            <Modal
                open={Boolean(deleteTarget)}
                onClose={closeDeletePrompt}
                title="Delete location"
                hideDefaultFooter
                maxHeight={440}
            >
                <LocationDeleteConfirmation
                    locationName={deleteTarget?.name ?? "this location"}
                    deleting={deleting}
                    error={deleteError}
                    onCancel={closeDeletePrompt}
                    onConfirm={() => void handleDelete()}
                />
            </Modal>

            <Modal
                open={isModalOpen}
                onClose={closeModal}
                title={editingLocation ? "Edit location" : "Add location"}
                hideDefaultFooter
                maxHeight={720}
            >
                <form
                    className="planningLocationsModal"
                    onSubmit={(event) => void handleSave(event)}
                >
                    <label className="planningLocationsModalField">
                        <span>Location name</span>
                        <input
                            className="modal_input"
                            value={draft.name ?? ""}
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, name: event.target.value }));
                                if (saveError) setSaveError(null);
                            }}
                            placeholder="Example: Rotterdam Hall"
                            disabled={saving}
                        />
                    </label>
                    <PlanningLocationAddressFields
                        value={draft}
                        onChange={(field, nextValue) => {
                            setDraft((current) => ({ ...current, [field]: nextValue }));
                            if (saveError) setSaveError(null);
                        }}
                        disabled={saving}
                    />
                    <label className="planningLocationsModalField">
                        <span>Notes</span>
                        <textarea
                            className="modal_input planningLocationsTextarea"
                            value={draft.notes ?? ""}
                            onChange={(event) => {
                                setDraft((current) => ({ ...current, notes: event.target.value }));
                                if (saveError) setSaveError(null);
                            }}
                            placeholder="Optional guidance for planners"
                            disabled={saving}
                        />
                    </label>
                    <fieldset className="planningLocationsModalField planningLocationsClientField">
                        <legend>Clients</legend>
                        <LocationClientsPicker
                            clients={allClients}
                            selectedClientIds={draft.prioritizedClientCompanyIds ?? []}
                            disabled={saving}
                            onChange={(prioritizedClientCompanyIds) => {
                                setDraft((current) => ({
                                    ...current,
                                    prioritizedClientCompanyIds,
                                }));
                                if (saveError) setSaveError(null);
                            }}
                        />
                    </fieldset>
                    <div className="planningLocationsModalHint">
                        Locations stay listed here while {client.name || "this client"} is one of the
                        prioritized clients. Unchecking removes it from this client&apos;s page.
                    </div>
                    {saveError ? <div className="planningLocationsError">{saveError}</div> : null}
                    <div className="planningLocationsModalActions">
                        <button
                            type="button"
                            className="buttonSecondary"
                            onClick={closeModal}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="button"
                            disabled={saving || !draft.name?.trim()}
                        >
                            {saving ? "Saving..." : editingLocation ? "Save location" : "Add location"}
                        </button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
