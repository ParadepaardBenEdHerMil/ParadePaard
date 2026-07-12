// Humanized "when does my shift start" labels for the mobile dashboard hero
// card. Deliberately NOT a ticking seconds countdown: inside 24h it renders a
// calm "Starts in 2 h 40 m" (refreshed once a minute by the caller), further
// out it falls back to calendar wording ("Tomorrow at 17:00", "Friday 17 Jul,
// 07:00") where a countdown would be meaningless.

export type ShiftTimingPhase = "inProgress" | "startingSoon" | "tomorrow" | "later";

export interface ShiftTiming {
    phase: ShiftTimingPhase;
    label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function timeOfDay(date: Date): string {
    const h = String(date.getHours()).padStart(2, "0");
    const m = String(date.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
}

function isCalendarTomorrow(start: Date, now: Date): boolean {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return (
        start.getFullYear() === tomorrow.getFullYear() &&
        start.getMonth() === tomorrow.getMonth() &&
        start.getDate() === tomorrow.getDate()
    );
}

function hoursAndMinutes(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h <= 0) return `${m} m`;
    if (m === 0) return `${h} h`;
    return `${h} h ${m} m`;
}

/**
 * Describe when a shift starts (or that it is running) relative to `now`.
 * `startIso`/`endIso` are the planning rows' local ISO datetimes.
 */
export function describeShiftTiming(startIso: string, endIso: string, now: Date): ShiftTiming {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return { phase: "later", label: "" };
    }

    if (now.getTime() >= start.getTime() && now.getTime() < end.getTime()) {
        const runningMinutes = Math.max(1, Math.floor((now.getTime() - start.getTime()) / 60000));
        const ago = runningMinutes < 60 ? `${runningMinutes} min` : hoursAndMinutes(runningMinutes);
        return { phase: "inProgress", label: `Started ${ago} ago · ends ${timeOfDay(end)}` };
    }

    const untilMs = start.getTime() - now.getTime();
    if (untilMs < DAY_MS) {
        const untilMinutes = Math.max(1, Math.floor(untilMs / 60000));
        return { phase: "startingSoon", label: `Starts in ${hoursAndMinutes(untilMinutes)}` };
    }

    if (isCalendarTomorrow(start, now)) {
        return { phase: "tomorrow", label: `Tomorrow at ${timeOfDay(start)}` };
    }

    const dayLabel = start.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "short",
    });
    return { phase: "later", label: `${dayLabel}, ${timeOfDay(start)}` };
}

/**
 * Pick the shift the hero card should show: the currently-running shift if
 * there is one, otherwise the next one to start. Rows whose end time already
 * passed are skipped regardless of input order.
 */
export function pickNextShift<T extends { startTime: string; endTime: string }>(
    rows: T[],
    now: Date
): T | null {
    const candidates = rows
        .filter((row) => {
            const end = new Date(row.endTime);
            return !Number.isNaN(end.getTime()) && end.getTime() > now.getTime();
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return candidates[0] ?? null;
}
