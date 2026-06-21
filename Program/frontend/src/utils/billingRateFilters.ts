export function getUniqueBillingRateFilterOptions(values: Array<string | null | undefined>): string[] {
    return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
        .sort((a, b) => a.localeCompare(b));
}

export function billingRateFilterMatches(value: string | null | undefined, query: string): boolean {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return true;
    return (value ?? "").toLowerCase().includes(normalizedQuery);
}
