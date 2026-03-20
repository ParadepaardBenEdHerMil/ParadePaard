import AsyncStorage from "@react-native-async-storage/async-storage";

const LOCAL_PREFIX = "pp.local.";

const localCache = new Map<string, string>();
const sessionCache = new Map<string, string>();
let hydrated = false;

function createStorageFromMap(map: Map<string, string>, persist: boolean): Storage {
    const storage: Storage = {
        get length() {
            return map.size;
        },
        clear() {
            const keys = [...map.keys()];
            map.clear();
            if (persist && keys.length > 0) {
                void AsyncStorage.multiRemove(keys.map((key) => `${LOCAL_PREFIX}${key}`));
            }
        },
        getItem(key: string) {
            return map.has(key) ? map.get(key)! : null;
        },
        key(index: number) {
            return [...map.keys()][index] ?? null;
        },
        removeItem(key: string) {
            map.delete(key);
            if (persist) {
                void AsyncStorage.removeItem(`${LOCAL_PREFIX}${key}`);
            }
        },
        setItem(key: string, value: string) {
            map.set(key, value);
            if (persist) {
                void AsyncStorage.setItem(`${LOCAL_PREFIX}${key}`, value);
            }
        },
    };

    return storage;
}

export const localStoragePolyfill = createStorageFromMap(localCache, true);
export const sessionStoragePolyfill = createStorageFromMap(sessionCache, false);

export async function hydrateStorage(): Promise<void> {
    if (hydrated) return;
    hydrated = true;
    try {
        const keys = await AsyncStorage.getAllKeys();
        const relevant = keys.filter((key) => key.startsWith(LOCAL_PREFIX));
        if (relevant.length === 0) return;
        const entries = await AsyncStorage.multiGet(relevant);
        entries.forEach(([fullKey, value]) => {
            if (value === null) return;
            localCache.set(fullKey.slice(LOCAL_PREFIX.length), value);
        });
    } catch {
        // Ignore hydration failures and continue with in-memory cache.
    }
}

export function installStoragePolyfill(): void {
    const g = globalThis as Record<string, unknown>;
    if (!g.localStorage) g.localStorage = localStoragePolyfill;
    if (!g.sessionStorage) g.sessionStorage = sessionStoragePolyfill;
}
