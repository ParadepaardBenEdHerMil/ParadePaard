export type FilterFieldKind =
    | { kind: "search" }
    | { kind: "text" }
    | { kind: "number" }
    | { kind: "decimal" }
    | { kind: "date" }
    | {
          kind: "select";
          options: ReadonlyArray<{ label: string; value: string }>;
          emptyLabel?: string;
      };

export type FilterFieldConfig = {
    /** Unique field key. Used in FilterRow.field. */
    field: string;
    /** Display label shown both in the field dropdown and as the value-input label. */
    label: string;
    /** Section name used as the optgroup heading. */
    section: string;
    /** Optional placeholder for input fields. */
    placeholder?: string;
    /** Optional input mode override. */
    inputMode?: "text" | "numeric" | "decimal";
    /** Optional maxLength for date or other constrained inputs. */
    maxLength?: number;
    kind: FilterFieldKind;
};

export type FilterRow = {
    id: string;
    field: string;
    value: string;
};

export type FilterSortConfig = {
    label?: string;
    options: ReadonlyArray<{ label: string; value: string }>;
    value: string;
    onChange: (value: string) => void;
    direction?: "asc" | "desc";
    onDirectionChange?: (direction: "asc" | "desc") => void;
    ascLabel?: string;
    descLabel?: string;
};
