import type { FilterRow } from "../components/common/FilterPanel.types";
import { parseDisplayDate } from "./dateInput";

export type FilterAccessor<T> = (item: T, value: string) => boolean;

export type FilterAccessors<T> = Record<string, FilterAccessor<T>>;

/**
 * Apply a dynamic set of filter rows against a list of items using a map of
 * per-field accessor functions. Rows with empty values are ignored, so the
 * default (empty) row contributes nothing to filtering.
 */
export function applyFilterRows<T>(
    items: readonly T[],
    rows: readonly FilterRow[],
    accessors: FilterAccessors<T>
): T[] {
    const activeRows = rows.filter((row) => row.value.trim().length > 0);
    if (activeRows.length === 0) return [...items];

    return items.filter((item) =>
        activeRows.every((row) => {
            const accessor = accessors[row.field];
            if (!accessor) return true;
            return accessor(item, row.value.trim());
        })
    );
}

/** Helper: case-insensitive substring match. */
export function textIncludes(haystack: string | null | undefined, needle: string): boolean {
    const term = needle.trim().toLowerCase();
    if (!term) return true;
    return (haystack ?? "").toLowerCase().includes(term);
}

/** Helper: parse a number, returns null if blank or invalid. */
export function parseFilterNumber(value: string): number | null {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
}

/** Helper: compare a date string with a dd/mm/yyyy formatted display value. */
export function dateFromAtLeast(itemDate: string | null | undefined, displayDate: string): boolean {
    const from = parseDisplayDate(displayDate);
    if (!from) return true;
    return (itemDate ?? "").split("T")[0] >= from;
}

export function dateToAtMost(itemDate: string | null | undefined, displayDate: string): boolean {
    const to = parseDisplayDate(displayDate);
    if (!to) return true;
    return (itemDate ?? "").split("T")[0] <= to;
}

/** Helper: equality on normalized strings. */
export function equalsNormalized(value: string | null | undefined, target: string): boolean {
    return (value ?? "").trim().toLowerCase() === target.trim().toLowerCase();
}
