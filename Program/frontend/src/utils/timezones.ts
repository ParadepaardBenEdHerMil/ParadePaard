export type TimeZoneOption = {
    value: string;
    label: string;
};

const FALLBACK_TIME_ZONES = [
    "UTC",
    "Europe/Amsterdam",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "Asia/Dubai",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
];

let cachedTimeZoneOptions: TimeZoneOption[] | null = null;

function getCurrentDate(): Date {
    return new Date();
}

function getOffsetLabel(timeZone: string, date = getCurrentDate()): string {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone,
            timeZoneName: "longOffset",
            hour: "2-digit",
            minute: "2-digit",
        }).formatToParts(date);
        const offset = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";
        return offset.replace("GMT", "UTC");
    } catch {
        return "UTC";
    }
}

function getEnglishTimeZoneName(timeZone: string, date = getCurrentDate()): string {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone,
            timeZoneName: "long",
            hour: "2-digit",
            minute: "2-digit",
        }).formatToParts(date);
        return parts.find((part) => part.type === "timeZoneName")?.value ?? timeZone;
    } catch {
        return timeZone;
    }
}

export function isSupportedTimeZone(value: string | null | undefined): boolean {
    const normalized = value?.trim();
    if (!normalized) return false;

    try {
        new Intl.DateTimeFormat("en-US", { timeZone: normalized });
        return true;
    } catch {
        return false;
    }
}

export function getBrowserTimeZone(): string {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return isSupportedTimeZone(resolved) ? resolved : "UTC";
}

export function formatTimeZoneLabel(timeZone: string | null | undefined): string {
    const normalized = isSupportedTimeZone(timeZone) ? timeZone!.trim() : "UTC";
    const date = getCurrentDate();
    const offsetLabel = getOffsetLabel(normalized, date);
    const englishName = getEnglishTimeZoneName(normalized, date);
    const friendlyId = normalized.replace(/_/g, " ");

    if (englishName === normalized || englishName === friendlyId) {
        return `${offsetLabel} ${friendlyId}`;
    }

    return `${offsetLabel} ${friendlyId} - ${englishName}`;
}

export function getTimeZoneOptions(): TimeZoneOption[] {
    if (cachedTimeZoneOptions) {
        return cachedTimeZoneOptions;
    }

    const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    const supportedValues = typeof supportedValuesOf === "function"
        ? supportedValuesOf("timeZone")
        : FALLBACK_TIME_ZONES;
    const date = getCurrentDate();
    const uniqueValues = [...new Set(["UTC", getBrowserTimeZone(), ...supportedValues])];

    cachedTimeZoneOptions = uniqueValues
        .filter((value) => isSupportedTimeZone(value))
        .map((value) => ({
            value,
            label: formatTimeZoneLabelForDate(value, date),
        }))
        .sort((left, right) => left.label.localeCompare(right.label, "en"));

    return cachedTimeZoneOptions;
}

function formatTimeZoneLabelForDate(timeZone: string, date: Date): string {
    const offsetLabel = getOffsetLabel(timeZone, date);
    const englishName = getEnglishTimeZoneName(timeZone, date);
    const friendlyId = timeZone.replace(/_/g, " ");

    if (englishName === timeZone || englishName === friendlyId) {
        return `${offsetLabel} ${friendlyId}`;
    }

    return `${offsetLabel} ${friendlyId} - ${englishName}`;
}
