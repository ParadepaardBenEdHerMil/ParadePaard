import { describe, expect, it } from "vitest";
import { canScrollHorizontally, createBottomBarScroll, type HorizontalScroller } from "./bottomBarScroll";

function scroller(overrides: Partial<HorizontalScroller> = {}): HorizontalScroller {
    return { scrollWidth: 642, clientWidth: 375, scrollLeft: 0, ...overrides };
}

describe("canScrollHorizontally", () => {
    it("is true only when content is wider than the viewport", () => {
        expect(canScrollHorizontally(scroller())).toBe(true);
        expect(canScrollHorizontally(scroller({ scrollWidth: 375 }))).toBe(false);
    });
});

describe("bottom bar wheel panning", () => {
    it("pans the bar sideways on a vertical wheel gesture", () => {
        const el = scroller();
        const bar = createBottomBarScroll(el);
        expect(bar.wheel(0, 120)).toBe(true);
        expect(el.scrollLeft).toBe(120);
    });

    it("leaves dominant horizontal gestures to native scrolling", () => {
        const el = scroller();
        const bar = createBottomBarScroll(el);
        expect(bar.wheel(50, 10)).toBe(false);
        expect(el.scrollLeft).toBe(0);
    });

    it("does nothing when every tab already fits", () => {
        const el = scroller({ scrollWidth: 375 });
        const bar = createBottomBarScroll(el);
        expect(bar.wheel(0, 120)).toBe(false);
        expect(el.scrollLeft).toBe(0);
    });
});

describe("bottom bar drag scrubbing", () => {
    it("scrolls opposite to the pointer movement while dragging", () => {
        const el = scroller({ scrollLeft: 100 });
        const bar = createBottomBarScroll(el);
        bar.pointerDown("mouse", 300);
        bar.pointerMove(100); // drag 200px left
        expect(el.scrollLeft).toBe(300);
    });

    it("suppresses exactly one click after a real drag", () => {
        const el = scroller();
        const bar = createBottomBarScroll(el);
        bar.pointerDown("mouse", 300);
        bar.pointerMove(100);
        bar.pointerUp();
        expect(bar.shouldSuppressClick()).toBe(true);
        expect(bar.shouldSuppressClick()).toBe(false);
    });

    it("keeps ordinary taps clickable (movement under the threshold)", () => {
        const el = scroller();
        const bar = createBottomBarScroll(el);
        bar.pointerDown("mouse", 300);
        bar.pointerMove(302);
        bar.pointerUp();
        expect(bar.shouldSuppressClick()).toBe(false);
    });

    it("ignores touch pointers — the browser scrolls those natively", () => {
        const el = scroller();
        const bar = createBottomBarScroll(el);
        bar.pointerDown("touch", 300);
        bar.pointerMove(100);
        expect(el.scrollLeft).toBe(0);
        expect(bar.shouldSuppressClick()).toBe(false);
    });

    it("stops scrolling once the pointer is released", () => {
        const el = scroller();
        const bar = createBottomBarScroll(el);
        bar.pointerDown("mouse", 300);
        bar.pointerMove(250);
        bar.pointerUp();
        bar.pointerMove(100);
        expect(el.scrollLeft).toBe(50);
    });
});
