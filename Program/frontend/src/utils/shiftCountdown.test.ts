import { describe, expect, it } from "vitest";
import { describeShiftTiming, pickNextShift } from "./shiftCountdown";

// Saturday 12 July 2026, 14:00 local time.
const NOW = new Date("2026-07-12T14:00:00");

describe("describeShiftTiming", () => {
    it("shows a running shift with when it started and when it ends", () => {
        const timing = describeShiftTiming("2026-07-12T13:35:00", "2026-07-12T23:00:00", NOW);
        expect(timing.phase).toBe("inProgress");
        expect(timing.label).toBe("Started 25 min ago · ends 23:00");
    });

    it("uses hours + minutes once a running shift is older than an hour", () => {
        const timing = describeShiftTiming("2026-07-12T11:30:00", "2026-07-12T23:00:00", NOW);
        expect(timing.label).toBe("Started 2 h 30 m ago · ends 23:00");
    });

    it("counts down within 24 hours", () => {
        const timing = describeShiftTiming("2026-07-12T16:40:00", "2026-07-12T23:00:00", NOW);
        expect(timing.phase).toBe("startingSoon");
        expect(timing.label).toBe("Starts in 2 h 40 m");
    });

    it("drops the hours part when the shift starts within the hour", () => {
        const timing = describeShiftTiming("2026-07-12T14:40:00", "2026-07-12T23:00:00", NOW);
        expect(timing.label).toBe("Starts in 40 m");
    });

    it("says Tomorrow for a shift on the next calendar day beyond 24h", () => {
        const timing = describeShiftTiming("2026-07-13T17:00:00", "2026-07-13T23:00:00", NOW);
        expect(timing.phase).toBe("tomorrow");
        expect(timing.label).toBe("Tomorrow at 17:00");
    });

    it("falls back to weekday wording for later shifts", () => {
        const timing = describeShiftTiming("2026-07-17T07:00:00", "2026-07-17T15:00:00", NOW);
        expect(timing.phase).toBe("later");
        expect(timing.label).toBe("Friday 17 Jul, 07:00");
    });

    it("treats a next-day shift that starts within 24h as a countdown, not Tomorrow", () => {
        const timing = describeShiftTiming("2026-07-13T07:00:00", "2026-07-13T15:00:00", NOW);
        expect(timing.phase).toBe("startingSoon");
        expect(timing.label).toBe("Starts in 17 h");
    });
});

describe("pickNextShift", () => {
    const shift = (startTime: string, endTime: string) => ({ startTime, endTime });

    it("prefers the currently running shift over later ones", () => {
        const running = shift("2026-07-12T13:00:00", "2026-07-12T23:00:00");
        const later = shift("2026-07-14T09:00:00", "2026-07-14T17:00:00");
        expect(pickNextShift([later, running], NOW)).toBe(running);
    });

    it("skips shifts that already ended even when listed first", () => {
        const ended = shift("2026-07-11T09:00:00", "2026-07-11T17:00:00");
        const upcoming = shift("2026-07-13T09:00:00", "2026-07-13T17:00:00");
        expect(pickNextShift([ended, upcoming], NOW)).toBe(upcoming);
    });

    it("returns null when nothing is upcoming", () => {
        const ended = shift("2026-07-11T09:00:00", "2026-07-11T17:00:00");
        expect(pickNextShift([ended], NOW)).toBeNull();
    });
});
