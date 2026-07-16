// Frontend resolution of preset merge fields + HTML->text flattening. Used for the onboarding
// review note, which is sent as plain text by auth-service (which does not resolve placeholders or
// render HTML). Mirrors the backend MergeFieldResolver link catalogue.

const LINK_PATHS: Record<string, string> = {
    app_url: "",
    home_url: "/",
    login_url: "/login",
    reset_password_url: "/forgot-password",
    apply_url: "/apply",
    planning_url: "/my-planning",
    account_url: "/account",
    employment_url: "/account/employment",
    payslips_url: "/payslips",
    messages_url: "/messages",
};

function resolveLinks(content: string, baseUrl: string): string {
    const base = baseUrl.replace(/\/$/, "");
    let out = content;
    for (const [key, path] of Object.entries(LINK_PATHS)) {
        out = out.split(`{{${key}}}`).join(base + path);
    }
    return out;
}

function resolvePersonalization(content: string, firstName: string, fullName: string): string {
    return content.split("{{first_name}}").join(firstName).split("{{full_name}}").join(fullName);
}

export function htmlToText(html: string): string {
    let text = html
        .replace(/<\s*br\s*\/?>/gi, "\n")
        .replace(/<\/\s*(p|div|li|tr|h[1-6])\s*>/gi, "\n")
        .replace(/<\s*li[^>]*>/gi, "- ")
        .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2 ($1)")
        .replace(/<[^>]+>/g, "");
    // Decode HTML entities via the DOM.
    const el = document.createElement("textarea");
    el.innerHTML = text;
    text = el.value;
    return text.replace(/\n{3,}/g, "\n\n").trim();
}

/** Resolves a preset's HTML body against a recipient and flattens it to plain text. */
export function presetBodyToPlainNote(
    html: string,
    opts: { baseUrl: string; firstName: string; fullName: string }
): string {
    const resolved = resolvePersonalization(
        resolveLinks(html, opts.baseUrl),
        opts.firstName,
        opts.fullName
    );
    return htmlToText(resolved);
}
