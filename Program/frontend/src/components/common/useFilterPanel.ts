import { useCallback, useMemo, useState } from "react";
import type { FilterFieldConfig, FilterRow } from "./FilterPanel.types";

const newRowId = () => {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return `row-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
};

export type FilterPanelController = {
    fields: FilterFieldConfig[];
    rows: FilterRow[];
    open: boolean;
    setOpen: (open: boolean) => void;
    toggleOpen: () => void;
    updateRow: (id: string, patch: Partial<FilterRow>) => void;
    addRow: () => void;
    removeRow: (id: string) => void;
    reset: () => void;
    /** Tells whether at least one row has a value (any active filter). */
    hasActiveFilters: boolean;
};

export type UseFilterPanelOptions = {
    fields: FilterFieldConfig[];
    defaultOpen?: boolean;
};

const buildInitialRow = (fields: FilterFieldConfig[]): FilterRow => ({
    id: newRowId(),
    field: fields[0]?.field ?? "",
    value: "",
});

export function useFilterPanel({ fields, defaultOpen = false }: UseFilterPanelOptions): FilterPanelController {
    const [open, setOpen] = useState<boolean>(defaultOpen);
    const [rows, setRows] = useState<FilterRow[]>(() => [buildInitialRow(fields)]);

    const toggleOpen = useCallback(() => setOpen((value) => !value), []);

    const updateRow = useCallback(
        (id: string, patch: Partial<FilterRow>) => {
            setRows((prev) =>
                prev.map((row) => {
                    if (row.id !== id) return row;
                    return { ...row, ...patch };
                })
            );
        },
        []
    );

    const addRow = useCallback(() => {
        setRows((prev) => [...prev, buildInitialRow(fields)]);
    }, [fields]);

    const removeRow = useCallback((id: string) => {
        setRows((prev) => {
            const next = prev.filter((row) => row.id !== id);
            return next.length > 0 ? next : [buildInitialRow(fields)];
        });
    }, [fields]);

    const reset = useCallback(() => {
        setRows([buildInitialRow(fields)]);
    }, [fields]);

    const hasActiveFilters = useMemo(
        () => rows.some((row) => row.value.trim().length > 0),
        [rows]
    );

    return {
        fields,
        rows,
        open,
        setOpen,
        toggleOpen,
        updateRow,
        addRow,
        removeRow,
        reset,
        hasActiveFilters,
    };
}
