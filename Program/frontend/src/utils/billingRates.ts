export type BillingRateScope =
    | "CLIENT_FUNCTION"
    | "PROJECT_FUNCTION"
    | "CLIENT_EMPLOYEE_FUNCTION"
    | "PROJECT_EMPLOYEE_FUNCTION"
    | string;

export type BillingRateSectionCount = {
    visible: number;
    total: number;
    emptyLabel: string;
};

export function billingRateScopeLabel(scope: BillingRateScope): string {
    switch (scope) {
        case "CLIENT_FUNCTION":
            return "Client default";
        case "PROJECT_FUNCTION":
            return "Project rate";
        case "CLIENT_EMPLOYEE_FUNCTION":
            return "Client employee override";
        case "PROJECT_EMPLOYEE_FUNCTION":
            return "Project employee override";
        default:
            return "Billing rate";
    }
}

export function billingRateSectionCountLabel(count: BillingRateSectionCount): string {
    if (count.total === 0) return count.emptyLabel;
    if (count.visible === count.total) return `${count.total} rate${count.total === 1 ? "" : "s"}`;
    return `${count.visible} of ${count.total} rates`;
}
