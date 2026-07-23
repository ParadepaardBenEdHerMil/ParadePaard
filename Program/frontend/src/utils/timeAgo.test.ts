import { describe, expect, it } from "vitest";
import { formatTimeAgo } from "./timeAgo";

describe("formatTimeAgo", () => {
    const now = new Date("2026-07-23T12:00:00");

    it("returns an empty string for missing or invalid timestamps", () => {
        expect(formatTimeAgo(null, now)).toBe("");
        expect(formatTimeAgo(undefined, now)).toBe("");
        expect(formatTimeAgo("not-a-date", now)).toBe("");
    });

    it("labels anything under a minute as just now", () => {
        expect(formatTimeAgo("2026-07-23T11:59:30", now)).toBe("just now");
        expect(formatTimeAgo("2026-07-23T12:00:00", now)).toBe("just now");
    });

    it("uses minutes under an hour", () => {
        expect(formatTimeAgo("2026-07-23T11:55:00", now)).toBe("5 min ago");
        expect(formatTimeAgo("2026-07-23T11:00:30", now)).toBe("59 min ago");
    });

    it("uses hours under a day", () => {
        expect(formatTimeAgo("2026-07-23T09:00:00", now)).toBe("3 h ago");
        expect(formatTimeAgo("2026-07-22T12:30:00", now)).toBe("23 h ago");
    });

    it("uses days under a month", () => {
        expect(formatTimeAgo("2026-07-21T12:00:00", now)).toBe("2 d ago");
        expect(formatTimeAgo("2026-06-25T12:00:00", now)).toBe("28 d ago");
    });

    it("falls back to a date for older timestamps", () => {
        expect(formatTimeAgo("2026-05-01T12:00:00", now)).toBe("01/05/2026");
    });
});
