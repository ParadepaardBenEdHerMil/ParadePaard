import { useMemo, type ReactNode } from "react";
import type { FilterFieldConfig, FilterSortConfig } from "./FilterPanel.types";
import type { FilterPanelController } from "./useFilterPanel";
import { normalizeDateInput } from "../../utils/dateInput";
import "../../stylesheets/common/FilterPanel.css";

function FilterIcon({ className }: { className?: string }) {
    return (
        <svg
            className={className}
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M4 5h16l-6 8v6l-4-2v-4z" />
        </svg>
    );
}

type FilterToggleButtonProps = {
    controller: FilterPanelController;
    label?: string;
    title?: string;
};

export function FilterToggleButton({ controller, label = "Filters", title }: FilterToggleButtonProps) {
    const { open, toggleOpen, hasActiveFilters } = controller;
    return (
        <button
            type="button"
            className={`filterPanelToggle${hasActiveFilters ? " filterPanelToggle--active" : ""}${
                open ? " filterPanelToggle--open" : ""
            }`}
            onClick={toggleOpen}
            aria-expanded={open}
            aria-label={label}
            title={title ?? label}
        >
            <FilterIcon className="filterPanelToggleIcon" />
            {hasActiveFilters ? <span className="filterPanelToggleDot" aria-hidden="true" /> : null}
        </button>
    );
}

type FilterPanelBodyProps = {
    controller: FilterPanelController;
    resultMeta?: ReactNode;
    sort?: FilterSortConfig;
    /** Optional extra controls shown alongside Add/Reset (e.g., a column picker). */
    extraActions?: ReactNode;
    /** Optional content rendered below the main filter rows (e.g., column picker). */
    extraContent?: ReactNode;
};

type GroupedFields = ReadonlyArray<{ section: string; fields: FilterFieldConfig[] }>;

function groupBySection(fields: FilterFieldConfig[]): GroupedFields {
    const order: string[] = [];
    const buckets = new Map<string, FilterFieldConfig[]>();
    fields.forEach((field) => {
        if (!buckets.has(field.section)) {
            order.push(field.section);
            buckets.set(field.section, []);
        }
        buckets.get(field.section)!.push(field);
    });
    return order.map((section) => ({ section, fields: buckets.get(section)! }));
}

export function FilterPanelBody({ controller, resultMeta, sort, extraActions, extraContent }: FilterPanelBodyProps) {
    const { fields, rows, open, updateRow, addRow, removeRow, reset } = controller;
    const grouped = useMemo(() => groupBySection(fields), [fields]);
    const fieldsByKey = useMemo(() => {
        const map = new Map<string, FilterFieldConfig>();
        fields.forEach((field) => map.set(field.field, field));
        return map;
    }, [fields]);

    if (!open) return null;

    return (
        <div className="filterPanel">
            {sort ? (
                <div className="filterPanelSortRow">
                    <label className="filterPanelField filterPanelField--label">
                        <span>{sort.label ?? "Sort by"}</span>
                        <select
                            className="filterPanelSelect"
                            value={sort.value}
                            onChange={(event) => sort.onChange(event.target.value)}
                        >
                            {sort.options.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    {sort.onDirectionChange ? (
                        <label className="filterPanelField filterPanelField--direction">
                            <span>Direction</span>
                            <select
                                className="filterPanelSelect"
                                value={sort.direction ?? "asc"}
                                onChange={(event) =>
                                    sort.onDirectionChange?.(event.target.value as "asc" | "desc")
                                }
                            >
                                <option value="asc">{sort.ascLabel ?? "A → Z"}</option>
                                <option value="desc">{sort.descLabel ?? "Z → A"}</option>
                            </select>
                        </label>
                    ) : null}
                </div>
            ) : null}
            <div className="filterPanelRows">
                {rows.map((row) => {
                    const fieldConfig = fieldsByKey.get(row.field) ?? fields[0];
                    return (
                        <div className="filterPanelRow" key={row.id}>
                            <label className="filterPanelField filterPanelField--field">
                                <span>Filter on</span>
                                <select
                                    className="filterPanelSelect"
                                    value={row.field}
                                    onChange={(event) =>
                                        updateRow(row.id, {
                                            field: event.target.value,
                                            value: "",
                                        })
                                    }
                                >
                                    {grouped.map((group) => (
                                        <optgroup key={group.section} label={group.section}>
                                            {group.fields.map((field) => (
                                                <option key={field.field} value={field.field}>
                                                    {field.label}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </label>
                            <label className="filterPanelField">
                                <span>{fieldConfig?.label ?? "Value"}</span>
                                <FilterValueInput
                                    field={fieldConfig}
                                    value={row.value}
                                    onChange={(value) => updateRow(row.id, { value })}
                                />
                            </label>
                            <button
                                type="button"
                                className="filterPanelRowButton"
                                onClick={() => removeRow(row.id)}
                                aria-label="Remove filter"
                                title="Remove filter"
                            >
                                <span aria-hidden="true">×</span>
                            </button>
                        </div>
                    );
                })}
            </div>
            <div className="filterPanelActions">
                <div className="filterPanelMeta">{resultMeta}</div>
                <div className="filterPanelActionsButtons">
                    {extraActions}
                    <button type="button" className="filterPanelButton" onClick={addRow}>
                        Add filter
                    </button>
                    <button type="button" className="filterPanelButton" onClick={reset}>
                        Reset filters
                    </button>
                </div>
            </div>
            {extraContent ? <div className="filterPanelExtra">{extraContent}</div> : null}
        </div>
    );
}

type FilterValueInputProps = {
    field: FilterFieldConfig | undefined;
    value: string;
    onChange: (value: string) => void;
};

function FilterValueInput({ field, value, onChange }: FilterValueInputProps) {
    if (!field) {
        return (
            <input
                className="filterPanelInput"
                type="text"
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
        );
    }

    if (field.kind.kind === "select") {
        const options = field.kind.options;
        return (
            <select
                className="filterPanelSelect"
                value={value}
                onChange={(event) => onChange(event.target.value)}
            >
                <option value="">{field.kind.emptyLabel ?? "Any"}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        );
    }

    const inputMode: "text" | "numeric" | "decimal" =
        field.inputMode ??
        (field.kind.kind === "number"
            ? "numeric"
            : field.kind.kind === "decimal"
                ? "decimal"
                : field.kind.kind === "date"
                    ? "numeric"
                    : "text");

    return (
        <input
            className="filterPanelInput"
            type={field.kind.kind === "search" ? "search" : "text"}
            inputMode={inputMode}
            value={value}
            onChange={(event) => {
                const raw = event.target.value;
                onChange(field.kind.kind === "date" ? normalizeDateInput(raw) : raw);
            }}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
        />
    );
}
