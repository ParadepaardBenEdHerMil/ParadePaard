// Mouse-input support for the phone bottom tab bar (PrimaryNav): the bar
// scrolls horizontally when a role has more tabs than fit, which touch handles
// natively but a mouse cannot (the scrollbar is hidden on touch). This module
// holds the input logic — wheel panning and click-drag scrubbing with click
// suppression — as plain functions over a minimal element surface, so it is
// unit-testable without a DOM. PrimaryNav.tsx wires it to real events.

export interface HorizontalScroller {
    scrollWidth: number;
    clientWidth: number;
    scrollLeft: number;
}

export function canScrollHorizontally(el: HorizontalScroller): boolean {
    return el.scrollWidth > el.clientWidth;
}

export interface BottomBarScrollController {
    /** Vertical wheel pans the bar sideways. Returns true when handled (caller prevents default). */
    wheel(deltaX: number, deltaY: number): boolean;
    /** Mouse button pressed over the bar. Non-mouse pointers are ignored (touch scrolls natively). */
    pointerDown(pointerType: string, clientX: number): void;
    pointerMove(clientX: number): void;
    pointerUp(): void;
    /** After a drag, the browser still fires a click on the tab under the pointer — suppress exactly that one. */
    shouldSuppressClick(): boolean;
}

const DRAG_THRESHOLD_PX = 5;

export function createBottomBarScroll(el: HorizontalScroller): BottomBarScrollController {
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startScrollLeft = 0;

    return {
        wheel(deltaX: number, deltaY: number): boolean {
            if (!canScrollHorizontally(el)) return false;
            // Horizontal wheel/trackpad gestures already scroll natively.
            if (Math.abs(deltaY) <= Math.abs(deltaX)) return false;
            el.scrollLeft += deltaY;
            return true;
        },

        pointerDown(pointerType: string, clientX: number): void {
            if (pointerType !== "mouse" || !canScrollHorizontally(el)) return;
            dragging = true;
            moved = false;
            startX = clientX;
            startScrollLeft = el.scrollLeft;
        },

        pointerMove(clientX: number): void {
            if (!dragging) return;
            const dx = clientX - startX;
            if (Math.abs(dx) > DRAG_THRESHOLD_PX) moved = true;
            el.scrollLeft = startScrollLeft - dx;
        },

        pointerUp(): void {
            dragging = false;
        },

        shouldSuppressClick(): boolean {
            if (!moved) return false;
            moved = false;
            return true;
        },
    };
}
