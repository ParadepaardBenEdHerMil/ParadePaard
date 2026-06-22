import { useEffect, useRef, useState } from "react";
import "../../stylesheets/common/BillingRateColumnFilter.css";

type BillingRateColumnFilterProps = {
    label: string;
    value: string;
    allLabel: string;
    searchPlaceholder: string;
    options: string[];
    variant?: "default" | "header";
    onChange: (value: string) => void;
};

type BillingRateColumnFilterRoot = {
    contains: (target: Node | null) => boolean;
};

export function shouldCloseBillingRateColumnFilter(
    root: BillingRateColumnFilterRoot | null,
    target: Node | null
) {
    return Boolean(root && target && !root.contains(target));
}

export default function BillingRateColumnFilter({
    label,
    value,
    allLabel,
    searchPlaceholder,
    options,
    variant = "default",
    onChange,
}: BillingRateColumnFilterProps) {
    const rootRef = useRef<HTMLDetailsElement | null>(null);
    const [open, setOpen] = useState(false);
    const normalizedValue = value.trim().toLowerCase();
    const visibleOptions = normalizedValue
        ? options.filter((option) => option.toLowerCase().includes(normalizedValue))
        : options;
    const scrollable = options.length > 10;
    const isHeader = variant === "header";
    const selectedLabel = value.trim() || (isHeader ? "" : allLabel);

    useEffect(() => {
        if (!open) return undefined;

        function handlePointerDown(event: MouseEvent | TouchEvent) {
            if (shouldCloseBillingRateColumnFilter(rootRef.current, event.target as Node | null)) {
                setOpen(false);
            }
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                setOpen(false);
            }
        }

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("touchstart", handlePointerDown, { passive: true });
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("touchstart", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open]);

    function selectValue(nextValue: string) {
        onChange(nextValue);
        setOpen(false);
    }

    return (
        <details
            className={`billingRatesColumnFilter${isHeader ? " billingRatesColumnFilter--header" : ""}`}
            onToggle={(event) => setOpen(event.currentTarget.open)}
            open={open}
            ref={rootRef}
        >
            <summary className="billingRatesColumnFilterSummary">
                <span className="billingRatesColumnFilterLabel">{label}</span>
                {selectedLabel ? (
                    <span className="billingRatesColumnFilterValue">{selectedLabel}</span>
                ) : null}
            </summary>
            <div className="billingRatesColumnFilterPanel">
                <input
                    className="modal_input billingRatesColumnFilterSearch"
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    placeholder={searchPlaceholder}
                    aria-label={searchPlaceholder}
                />
                <div
                    className={`billingRatesColumnFilterOptions${scrollable ? " billingRatesColumnFilterOptions--scrollable" : ""}`}
                    role="listbox"
                    aria-label={`${label} billing-rate filter options`}
                >
                    <button
                        type="button"
                        className={`billingRatesColumnFilterOption${value.trim() ? "" : " billingRatesColumnFilterOption--selected"}`}
                        onClick={() => selectValue("")}
                        role="option"
                        aria-selected={!value.trim()}
                    >
                        {allLabel}
                    </button>
                    {visibleOptions.length === 0 ? (
                        <div className="billingRatesColumnFilterEmpty">No matching options.</div>
                    ) : (
                        visibleOptions.map((option) => (
                            <button
                                key={option}
                                type="button"
                                className={`billingRatesColumnFilterOption${option === value ? " billingRatesColumnFilterOption--selected" : ""}`}
                                onClick={() => selectValue(option)}
                                role="option"
                                aria-selected={option === value}
                            >
                                {option}
                            </button>
                        ))
                    )}
                </div>
            </div>
        </details>
    );
}
