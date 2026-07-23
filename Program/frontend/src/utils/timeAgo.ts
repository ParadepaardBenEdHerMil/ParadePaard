const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Human-friendly "how long ago" label for timestamps such as shift
 * applications: "just now", "5 min ago", "3 h ago", "2 d ago". Falls back to
 * a dd/mm/yyyy date once it is more than a month old.
 */
export function formatTimeAgo(isoTimestamp: string | null | undefined, now: Date = new Date()): string {
    if (!isoTimestamp) return "";
    const then = new Date(isoTimestamp);
    if (Number.isNaN(then.getTime())) return "";

    const elapsedMs = now.getTime() - then.getTime();
    if (elapsedMs < MINUTE_MS) return "just now";
    if (elapsedMs < HOUR_MS) return `${Math.floor(elapsedMs / MINUTE_MS)} min ago`;
    if (elapsedMs < DAY_MS) return `${Math.floor(elapsedMs / HOUR_MS)} h ago`;
    if (elapsedMs < 31 * DAY_MS) return `${Math.floor(elapsedMs / DAY_MS)} d ago`;

    const day = String(then.getDate()).padStart(2, "0");
    const month = String(then.getMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${then.getFullYear()}`;
}
