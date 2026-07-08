import { describe, expect, it } from "vitest";
import {
    INITIAL_PROFILE_CROP,
    PROFILE_CROP_FRAME_SIZE,
    clampProfileCrop,
    getProfileCropBounds,
} from "./profilePictureCrop";

describe("profilePictureCrop", () => {
    it("covers the frame with no slack for a square image at zoom 1", () => {
        const bounds = getProfileCropBounds(500, 500, 1);
        expect(bounds.displayedWidth).toBe(PROFILE_CROP_FRAME_SIZE);
        expect(bounds.displayedHeight).toBe(PROFILE_CROP_FRAME_SIZE);
        expect(bounds.maxOffsetX).toBe(0);
        expect(bounds.maxOffsetY).toBe(0);
    });

    it("only allows horizontal panning for a wide image", () => {
        const bounds = getProfileCropBounds(1000, 500, 1);
        // Scaled to cover: height maps to the frame, width overflows.
        expect(bounds.displayedHeight).toBe(PROFILE_CROP_FRAME_SIZE);
        expect(bounds.displayedWidth).toBe(560);
        expect(bounds.maxOffsetX).toBe(140);
        expect(bounds.maxOffsetY).toBe(0);
    });

    it("grows the pannable area as the operator zooms in", () => {
        const bounds = getProfileCropBounds(500, 500, 2);
        expect(bounds.displayedWidth).toBe(560);
        expect(bounds.maxOffsetX).toBe(140);
        expect(bounds.maxOffsetY).toBe(140);
    });

    it("clamps offsets to the pannable bounds", () => {
        const clamped = clampProfileCrop(1000, 500, { zoom: 1, offsetX: 999, offsetY: 999 });
        expect(clamped.offsetX).toBe(140);
        expect(clamped.offsetY).toBe(0);

        const clampedNegative = clampProfileCrop(1000, 500, { zoom: 1, offsetX: -999, offsetY: -999 });
        expect(clampedNegative.offsetX).toBe(-140);
        expect(Math.abs(clampedNegative.offsetY)).toBe(0);
    });

    it("leaves an in-bounds offset untouched", () => {
        const clamped = clampProfileCrop(1000, 500, { zoom: 1, offsetX: 50, offsetY: 0 });
        expect(clamped).toEqual({ zoom: 1, offsetX: 50, offsetY: 0 });
    });

    it("starts centered and unzoomed", () => {
        expect(INITIAL_PROFILE_CROP).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
    });
});
