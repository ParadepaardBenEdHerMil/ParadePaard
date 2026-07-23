import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import Modal from "./Modal";
import { UserServices } from "../../services/user-service/UserServices";
import "../../stylesheets/FunctionPicker.css";

type FunctionPickerProps = {
    label: string;
    value: string;
    /** Show an "Add" affordance that persists a new function to the master list (admins only). */
    allowCreate?: boolean;
    disabled?: boolean;
    required?: boolean;
    placeholder?: string;
    onChange: (value: string) => void;
    onDirty?: () => void;
};

type CreateFunctionDraft = {
    functionName: string;
    department: string;
    hourlyWage: string;
};

const INITIAL_DRAFT: CreateFunctionDraft = { functionName: "", department: "", hourlyWage: "" };

/** Case-insensitive "contains" filter over the function names. */
export function filterFunctionSuggestions(options: string[], query: string): string[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return options;
    return options.filter((option) => option.toLowerCase().includes(normalizedQuery));
}

/** Wrap-around arrow-key navigation over the suggestion list. */
export function moveFunctionSuggestionIndex(
    currentIndex: number,
    key: "ArrowDown" | "ArrowUp",
    suggestionCount: number
): number {
    if (suggestionCount <= 0) return -1;
    if (key === "ArrowDown") return (currentIndex + 1 + suggestionCount) % suggestionCount;
    return (currentIndex - 1 + suggestionCount) % suggestionCount;
}

export default function FunctionPicker({
    label,
    value,
    allowCreate = false,
    disabled = false,
    required = false,
    placeholder = "Search job functions",
    onChange,
    onDirty,
}: FunctionPickerProps) {
    const [options, setOptions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createDraft, setCreateDraft] = useState<CreateFunctionDraft>(INITIAL_DRAFT);
    const [createError, setCreateError] = useState<string | null>(null);
    const [savingCreate, setSavingCreate] = useState(false);
    const [suggestionsOpen, setSuggestionsOpen] = useState(false);
    const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
    const listboxId = useId();

    const filteredOptions = useMemo(
        () => filterFunctionSuggestions(options, value).slice(0, 10),
        [options, value]
    );
    // Only offer to create when the typed value is genuinely new (not an existing function).
    const trimmedValue = value.trim();
    const isNewValue =
        trimmedValue.length > 0 &&
        !options.some((option) => option.toLowerCase() === trimmedValue.toLowerCase());

    async function loadOptions(): Promise<string[]> {
        const data = await UserServices.getFunctions();
        return data
            .filter((item) => item.active !== false)
            .map((item) => item.functionName)
            .filter(Boolean);
    }

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                setLoadError(null);
                const names = await loadOptions();
                if (cancelled) return;
                // De-dupe, name-sorted for a stable list.
                setOptions(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)));
            } catch (err: unknown) {
                if (cancelled) return;
                setLoadError(err instanceof Error ? err.message : "Failed to load job functions.");
                setOptions([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleValueChange(nextValue: string) {
        onChange(nextValue);
        setSuggestionsOpen(true);
        setActiveSuggestionIndex(-1);
        onDirty?.();
    }

    function handleSelect(name: string) {
        onChange(name);
        setSuggestionsOpen(false);
        setActiveSuggestionIndex(-1);
        onDirty?.();
    }

    function handleInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
        const navigationKey = event.key === "ArrowDown" || event.key === "ArrowUp" ? event.key : null;
        if (navigationKey) {
            event.preventDefault();
            setSuggestionsOpen(true);
            setActiveSuggestionIndex((currentIndex) =>
                moveFunctionSuggestionIndex(currentIndex, navigationKey, filteredOptions.length)
            );
            return;
        }
        if (event.key === "Enter" && suggestionsOpen && activeSuggestionIndex >= 0) {
            const selected = filteredOptions[activeSuggestionIndex];
            if (selected) {
                event.preventDefault();
                handleSelect(selected);
            }
            return;
        }
        if (event.key === "Escape") {
            setSuggestionsOpen(false);
            setActiveSuggestionIndex(-1);
        }
    }

    function openCreateModal() {
        setCreateDraft({ ...INITIAL_DRAFT, functionName: value.trim() });
        setCreateError(null);
        setIsCreateOpen(true);
    }

    async function handleCreateFunction() {
        const name = createDraft.functionName.trim();
        if (!name) {
            setCreateError("A function name is required.");
            return;
        }
        // hourly_wage is NOT NULL in contract-service, so a wage is required to create a function.
        const wageText = createDraft.hourlyWage.trim();
        const hourlyWage = wageText ? Number(wageText) : null;
        if (hourlyWage === null || Number.isNaN(hourlyWage) || hourlyWage < 0) {
            setCreateError("Enter a valid hourly wage.");
            return;
        }
        try {
            setSavingCreate(true);
            setCreateError(null);
            const created = await UserServices.createFunction({
                functionName: name,
                department: createDraft.department.trim() || null,
                hourlyWage,
                active: true,
            });
            setOptions((current) =>
                Array.from(new Set([...current, created.functionName])).sort((a, b) => a.localeCompare(b))
            );
            handleSelect(created.functionName);
            setIsCreateOpen(false);
            setCreateDraft(INITIAL_DRAFT);
        } catch (err: unknown) {
            setCreateError(err instanceof Error ? err.message : "Failed to create the job function.");
        } finally {
            setSavingCreate(false);
        }
    }

    return (
        <>
            <div className="functionPickerField">
                <span className="functionPickerLabel">
                    {label}
                    {required ? <span aria-hidden="true"> *</span> : null}
                </span>
                <div className="functionPickerRow">
                    <div className="functionPickerCombobox">
                        <input
                            className="modal_input"
                            value={value}
                            required={required}
                            onChange={(event) => handleValueChange(event.target.value)}
                            onFocus={() => setSuggestionsOpen(true)}
                            onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
                            onKeyDown={handleInputKeyDown}
                            placeholder={placeholder}
                            disabled={disabled}
                            role="combobox"
                            aria-autocomplete="list"
                            aria-expanded={suggestionsOpen}
                            aria-controls={listboxId}
                            aria-activedescendant={
                                suggestionsOpen && activeSuggestionIndex >= 0
                                    ? `${listboxId}-option-${activeSuggestionIndex}`
                                    : undefined
                            }
                        />
                        {suggestionsOpen && !loading ? (
                            <div className="functionPickerSuggestions" id={listboxId} role="listbox">
                                {filteredOptions.length > 0 ? (
                                    filteredOptions.map((name, index) => (
                                        <button
                                            type="button"
                                            id={`${listboxId}-option-${index}`}
                                            key={name}
                                            className={`functionPickerSuggestion${
                                                index === activeSuggestionIndex ? " functionPickerSuggestion--active" : ""
                                            }`}
                                            role="option"
                                            aria-selected={name.toLowerCase() === trimmedValue.toLowerCase()}
                                            onMouseDown={(event) => {
                                                event.preventDefault();
                                                handleSelect(name);
                                            }}
                                        >
                                            {name}
                                        </button>
                                    ))
                                ) : (
                                    <div className="functionPickerSuggestionEmpty">
                                        {trimmedValue
                                            ? "No matching job function — you can keep this as a custom entry."
                                            : "No job functions yet."}
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                    {allowCreate ? (
                        <button
                            type="button"
                            className="functionPickerAdd"
                            onClick={openCreateModal}
                            disabled={disabled}
                            title="Add this as a new job function"
                        >
                            Add
                        </button>
                    ) : null}
                </div>
                {loading ? <div className="functionPickerMeta">Loading job functions…</div> : null}
                {loadError ? <div className="functionPickerMeta functionPickerMeta--error">{loadError}</div> : null}
                {allowCreate && isNewValue && !loading && !loadError ? (
                    <div className="functionPickerMeta">
                        "{trimmedValue}" isn't in the list yet — use <strong>Add</strong> to save it for everyone.
                    </div>
                ) : null}
            </div>

            <Modal
                open={isCreateOpen}
                onClose={() => !savingCreate && setIsCreateOpen(false)}
                title="Add job function"
                hideDefaultFooter
                maxHeight={520}
            >
                <div className="functionPickerModal">
                    <label className="functionPickerModalField">
                        <span className="functionPickerLabel">Function name</span>
                        <input
                            className="modal_input"
                            value={createDraft.functionName}
                            onChange={(event) =>
                                setCreateDraft((current) => ({ ...current, functionName: event.target.value }))
                            }
                            placeholder="Example: Bar staff"
                            disabled={savingCreate}
                        />
                    </label>
                    <label className="functionPickerModalField">
                        <span className="functionPickerLabel">Department</span>
                        <input
                            className="modal_input"
                            value={createDraft.department}
                            onChange={(event) =>
                                setCreateDraft((current) => ({ ...current, department: event.target.value }))
                            }
                            placeholder="Optional"
                            disabled={savingCreate}
                        />
                    </label>
                    <label className="functionPickerModalField">
                        <span className="functionPickerLabel">Hourly wage (€)</span>
                        <input
                            className="modal_input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={createDraft.hourlyWage}
                            onChange={(event) =>
                                setCreateDraft((current) => ({ ...current, hourlyWage: event.target.value }))
                            }
                            placeholder="Example: 19.50"
                            disabled={savingCreate}
                        />
                    </label>
                    {createError ? <div className="functionPickerMeta functionPickerMeta--error">{createError}</div> : null}
                    <div className="functionPickerModalActions">
                        <button
                            type="button"
                            className="buttonSecondary"
                            onClick={() => setIsCreateOpen(false)}
                            disabled={savingCreate}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="button"
                            onClick={() => void handleCreateFunction()}
                            disabled={savingCreate || !createDraft.functionName.trim()}
                        >
                            {savingCreate ? "Saving…" : "Save function"}
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
