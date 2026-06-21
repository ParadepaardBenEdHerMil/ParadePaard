import "../../stylesheets/common/BillingRateColumnFilter.css";

type BillingRateColumnFilterProps = {
    label: string;
    value: string;
    allLabel: string;
    searchPlaceholder: string;
    options: string[];
    onChange: (value: string) => void;
};

export default function BillingRateColumnFilter({
    label,
    value,
    allLabel,
    searchPlaceholder,
    options,
    onChange,
}: BillingRateColumnFilterProps) {
    const normalizedValue = value.trim().toLowerCase();
    const visibleOptions = normalizedValue
        ? options.filter((option) => option.toLowerCase().includes(normalizedValue))
        : options;
    const selectedLabel = value.trim() || allLabel;
    const scrollable = options.length > 10;

    return (
        <details className="billingRatesColumnFilter">
            <summary className="billingRatesColumnFilterSummary">
                <span className="billingRatesColumnFilterLabel">{label}</span>
                <span className="billingRatesColumnFilterValue">{selectedLabel}</span>
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
                        onClick={() => onChange("")}
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
                                onClick={() => onChange(option)}
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
