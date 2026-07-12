import { useEffect, useState } from "react";

// The app's phone breakpoint (see mobile CSS conventions: 600px).
const PHONE_QUERY = "(max-width: 600px)";

function currentMatch(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia(PHONE_QUERY).matches;
}

/**
 * True while the viewport is phone-sized (<=600px), tracking resizes.
 * SSR/test-safe: without window/matchMedia it stays false, so server renders
 * and node-based tests see the desktop layout.
 */
export function useIsPhone(): boolean {
    const [isPhone, setIsPhone] = useState<boolean>(currentMatch);

    useEffect(() => {
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
        const media = window.matchMedia(PHONE_QUERY);
        const onChange = () => setIsPhone(media.matches);
        onChange();
        media.addEventListener("change", onChange);
        return () => media.removeEventListener("change", onChange);
    }, []);

    return isPhone;
}
