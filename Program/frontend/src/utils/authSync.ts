// ── Cross-tab auth session synchronization ──────────────────────────────────
//
// The JWT lives in an httpOnly cookie shared by every tab of this origin, so two
// tabs cannot hold two different identities at the same time: logging in as a
// second user in one tab silently swaps the cookie under the others. Those other
// tabs keep the previous user's in-memory auth state (status + permissions), so
// they still render screens the current cookie is no longer allowed to use and
// every write fails with 403 — until a manual reload.
//
// The fix a tab needs is exactly what a manual reload does: re-derive its auth
// state from the current cookie, from scratch. So when another tab publishes a
// new identity, we reload the passive tab rather than trying to patch its live
// React state in place. In-place patching races the other tab's in-flight
// login/logout (the cookie is mid-change) and can strand a tab on a stale screen
// or a stuck spinner; a full reload has no such race window.

const ACTIVE_USER_KEY = "authActiveUserId";

/**
 * Decides, for a `storage` event, whether it signals an identity change this tab
 * must reload for. Pure so it can be unit-tested without a DOM.
 *   - only the identity key matters
 *   - the value must actually differ from what this tab is showing
 *   - a tab that has not resolved its own identity yet (knownIdentity === null)
 *     has nothing stale to reload; it is still cold-loading and will read the
 *     current cookie on its own.
 */
export function shouldReloadForIdentityChange(
    changedKey: string | null,
    newValue: string | null,
    knownIdentity: string | null
): boolean {
    if (changedKey !== ACTIVE_USER_KEY) return false;
    if (knownIdentity === null) return false;
    return (newValue ?? null) !== knownIdentity;
}

/**
 * Records which user this origin is authenticated as (or clears it on logout).
 * Written by whichever tab last logged in or out; observed by the OTHER tabs via
 * the browser's `storage` event, which only fires in tabs that did not do the
 * write. Publish only AFTER the cookie has actually changed (post-login /
 * post-logout) so a reloading tab reads the settled cookie, not a mid-flight one.
 */
export function publishActiveIdentity(userId: string | null): void {
    try {
        if (userId) {
            localStorage.setItem(ACTIVE_USER_KEY, userId);
        } else {
            localStorage.removeItem(ACTIVE_USER_KEY);
        }
    } catch {
        // ignore storage failures (private mode, storage disabled)
    }
}

/**
 * Subscribe to cross-tab identity changes. `getKnownIdentity` returns the user id
 * this tab is currently showing; `onIdentityChange` runs when another tab has
 * switched the shared session to a different identity. Returns an unsubscribe
 * function.
 */
export function subscribeToIdentityChange(
    getKnownIdentity: () => string | null,
    onIdentityChange: () => void
): () => void {
    const handleStorage = (event: StorageEvent) => {
        if (shouldReloadForIdentityChange(event.key, event.newValue, getKnownIdentity())) {
            onIdentityChange();
        }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
}
