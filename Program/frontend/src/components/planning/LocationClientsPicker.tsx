import { useMemo, useState, type KeyboardEvent } from "react";
import type { PlanningClientCompanyDTO } from "../../services/user-service/UserServices";

type LocationClientsPickerProps = {
    clients: PlanningClientCompanyDTO[];
    selectedClientIds: string[];
    disabled?: boolean;
    onChange: (selectedClientIds: string[]) => void;
};

export default function LocationClientsPicker({
    clients,
    selectedClientIds,
    disabled = false,
    onChange,
}: LocationClientsPickerProps) {
    const [search, setSearch] = useState("");

    const selectedSet = useMemo(() => new Set(selectedClientIds), [selectedClientIds]);

    const selectedClients = useMemo(
        () =>
            selectedClientIds
                .map((id) => clients.find((client) => client.clientCompanyId === id))
                .filter(
                    (client): client is PlanningClientCompanyDTO => Boolean(client)
                )
                .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")),
        [clients, selectedClientIds]
    );

    const searchResults = useMemo(() => {
        const term = search.trim().toLowerCase();
        if (!term) return [];
        return clients
            .filter((client) => !selectedSet.has(client.clientCompanyId))
            .filter((client) => (client.name ?? "").toLowerCase().includes(term))
            .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
            .slice(0, 8);
    }, [clients, search, selectedSet]);

    const addClient = (clientCompanyId: string) => {
        if (selectedSet.has(clientCompanyId)) return;
        onChange([...selectedClientIds, clientCompanyId]);
    };

    const removeClient = (clientCompanyId: string) => {
        onChange(selectedClientIds.filter((id) => id !== clientCompanyId));
    };

    const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        const first = searchResults[0];
        if (first) {
            addClient(first.clientCompanyId);
            setSearch("");
        }
    };

    return (
        <div className="roleWizardField">
            <label className="roleWizardField">
                <span className="roleWizardLabel">Find client</span>
                <div className="roleWizardSearchWrap">
                    <input
                        className="modal_input"
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        onKeyDown={handleKey}
                        placeholder="Search by client name"
                        disabled={disabled}
                    />
                    {search.trim() && searchResults.length > 0 ? (
                        <div
                            className="roleWizardUserList roleWizardUserList--dropdown"
                            role="listbox"
                            aria-label="Search results"
                        >
                            {searchResults.map((client) => (
                                <button
                                    key={client.clientCompanyId}
                                    type="button"
                                    className="roleWizardUserItem"
                                    onClick={() => {
                                        addClient(client.clientCompanyId);
                                        setSearch("");
                                    }}
                                    disabled={disabled}
                                    role="option"
                                >
                                    <span className="roleWizardUserName">{client.name}</span>
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
            </label>
            {search.trim() && searchResults.length === 0 ? (
                <div className="roleWizardMeta">No matches found.</div>
            ) : null}
            {selectedClients.length > 0 ? (
                <div className="roleWizardField">
                    <div className="roleWizardHeaderRow">
                        <span className="roleWizardLabel">Selected clients</span>
                        <span className="roleWizardMeta">
                            {selectedClients.length} selected
                        </span>
                    </div>
                    <div
                        className="roleWizardUserList"
                        role="listbox"
                        aria-label="Selected clients"
                    >
                        {selectedClients.map((client) => (
                            <div
                                key={client.clientCompanyId}
                                className="roleWizardUserItem roleWizardUserItem--selected"
                            >
                                <div className="roleWizardUserMeta">
                                    <span className="roleWizardUserName">{client.name}</span>
                                </div>
                                <button
                                    type="button"
                                    className="roleWizardUserRemove"
                                    onClick={() => removeClient(client.clientCompanyId)}
                                    disabled={disabled}
                                    aria-label={`Remove ${client.name}`}
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="roleWizardMeta">No clients selected.</div>
            )}
        </div>
    );
}
