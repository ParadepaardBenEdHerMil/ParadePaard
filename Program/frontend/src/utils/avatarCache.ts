// Lightweight localStorage cache for the current user's profile picture.
//
// Why this exists: the backend serves /api/users/me/profile-picture with
// Cache-Control: no-store, so every page refresh re-fetches the blob and
// the avatar pops in a moment after the rest of the navbar. Caching the
// image as a data URL lets us render it synchronously on mount; we then
// re-fetch in the background and replace the cached value if it changed.
//
// The cache is cleared on logout (alongside clearAuthCache) so a different
// user signing in on the same browser never sees the previous avatar.

const AVATAR_KEY = "cachedProfileAvatar";
const AVATAR_AT_KEY = "cachedProfileAvatarAt";

// Refresh in the background, but treat the cache as authoritative for at
// most 7 days. After that we ignore it and wait for the network fetch.
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type CachedAvatar =
    | { kind: "image"; dataUrl: string }
    | { kind: "none" };

export function readCachedAvatar(): CachedAvatar | null {
    try {
        const raw = localStorage.getItem(AVATAR_KEY);
        if (!raw) return null;
        const tsRaw = localStorage.getItem(AVATAR_AT_KEY);
        const ts = Number(tsRaw);
        if (!Number.isFinite(ts) || Date.now() - ts > CACHE_TTL_MS) return null;
        if (raw === "none") return { kind: "none" };
        if (raw.startsWith("data:")) return { kind: "image", dataUrl: raw };
        return null;
    } catch {
        return null;
    }
}

export function writeCachedAvatar(value: CachedAvatar): void {
    try {
        localStorage.setItem(AVATAR_KEY, value.kind === "none" ? "none" : value.dataUrl);
        localStorage.setItem(AVATAR_AT_KEY, String(Date.now()));
    } catch {
        // Ignore quota errors; the avatar simply won't be cached this time.
    }
}

export function clearCachedAvatar(): void {
    try {
        localStorage.removeItem(AVATAR_KEY);
        localStorage.removeItem(AVATAR_AT_KEY);
    } catch {
        // ignore
    }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () =>
            reject(reader.error ?? new Error("Failed to read profile picture"));
        reader.readAsDataURL(blob);
    });
}
