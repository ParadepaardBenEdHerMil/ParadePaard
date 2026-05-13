export function spinnerTextForPath(pathname: string): string {
    const path = (pathname || "").toLowerCase();

    if (path.startsWith("/management/onboarding-review")) return "Loading onboarding review";
    if (path.startsWith("/management/contracts")) return "Loading contracts";
    if (path.startsWith("/management/payslip-review")) return "Loading payslip review";
    if (path.startsWith("/management/payslips/")) return "Loading payslip details";
    if (path.startsWith("/payslips/")) return "Loading payslip details";
    if (path.startsWith("/payslips")) return "Loading payslips";
    if (path.startsWith("/management/users")) return "Loading users";
    if (path.startsWith("/management/onboarding")) return "Loading onboarding";
    if (path.startsWith("/account")) return "Loading account";
    if (path.startsWith("/management/travel-claims")) return "Loading travel claims";
    if (path.startsWith("/work-history")) return "Loading work history";
    if (path.startsWith("/onboarding")) return "Loading onboarding";
    if (path.startsWith("/dashboard")) return "Loading dashboard";
    if (path === "/") return "Loading home";

    return "Loading...";
}
