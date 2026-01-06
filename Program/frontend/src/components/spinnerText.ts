export function spinnerTextForPath(pathname: string): string {
    const path = (pathname || "").toLowerCase();

    if (path.startsWith("/admin/payslip-review")) return "Loading payslip review";
    if (path.startsWith("/admin/payslip/")) return "Loading payslip details";
    if (path.startsWith("/payslips/")) return "Loading payslip details";
    if (path.startsWith("/payslips")) return "Loading payslips";
    if (path.startsWith("/admin/users")) return "Loading users";
    if (path.startsWith("/admin/onboarding")) return "Loading admin onboarding";
    if (path.startsWith("/profile")) return "Loading profile";
    if (path.startsWith("/settings")) return "Loading settings";
    if (path.startsWith("/work-history")) return "Loading work history";
    if (path.startsWith("/onboarding")) return "Loading onboarding";
    if (path.startsWith("/dashboard")) return "Loading dashboard";
    if (path === "/") return "Loading home";

    return "Loading...";
}
