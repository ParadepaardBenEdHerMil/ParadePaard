import { installStoragePolyfill } from "./storage";

type Listener = (event: { type: string; [key: string]: unknown }) => void;

function createEventTarget() {
    const listeners = new Map<string, Set<Listener>>();

    return {
        addEventListener(type: string, listener: Listener) {
            const set = listeners.get(type) ?? new Set<Listener>();
            set.add(listener);
            listeners.set(type, set);
        },
        removeEventListener(type: string, listener: Listener) {
            listeners.get(type)?.delete(listener);
        },
        dispatchEvent(event: { type: string; [key: string]: unknown }) {
            const set = listeners.get(event.type);
            if (!set) return true;
            [...set].forEach((listener) => {
                try {
                    listener(event);
                } catch {
                    // Ignore listener errors to match browser event dispatch behavior.
                }
            });
            return true;
        },
    };
}

function createDocumentPolyfill() {
    const eventTarget = createEventTarget();
    return {
        ...eventTarget,
        body: {
            appendChild: () => undefined,
            removeChild: () => undefined,
        },
        createElement: (_tag: string) => ({
            setAttribute: () => undefined,
            removeAttribute: () => undefined,
            click: () => undefined,
        }),
        documentElement: {
            style: {
                setProperty: () => undefined,
                removeProperty: () => undefined,
            },
        },
        getElementById: () => null,
    };
}

function ensureEventCtor() {
    const g = globalThis as Record<string, unknown>;
    if (typeof g.Event === "function") return;
    class BasicEvent {
        type: string;
        constructor(type: string) {
            this.type = type;
        }
    }
    g.Event = BasicEvent;
}

function ensureWindowPolyfill() {
    const g = globalThis as Record<string, unknown>;
    const existing = g.window as (Record<string, unknown> & ReturnType<typeof createEventTarget>) | undefined;

    // In real browsers these properties already exist and some are read-only (e.g. window.history).
    // Do not assign over them; only backfill missing APIs in non-browser environments.
    if (
        existing &&
        typeof existing.addEventListener === "function" &&
        typeof existing.removeEventListener === "function" &&
        typeof existing.dispatchEvent === "function"
    ) {
        if (typeof existing.confirm !== "function") {
            try {
                existing.confirm = () => false;
            } catch {
                // ignore readonly host objects
            }
        }
        return;
    }

    const base = existing ?? ({} as Record<string, unknown> & ReturnType<typeof createEventTarget>);
    const eventTarget = createEventTarget();
    base.addEventListener = base.addEventListener ?? eventTarget.addEventListener;
    base.removeEventListener = base.removeEventListener ?? eventTarget.removeEventListener;
    base.dispatchEvent = base.dispatchEvent ?? eventTarget.dispatchEvent;
    base.history = (base.history as Record<string, unknown> | undefined) ?? { length: 1 };
    base.location =
        (base.location as Record<string, unknown> | undefined) ?? { pathname: "/", search: "" };
    if (typeof base.confirm !== "function") {
        base.confirm = () => false;
    }
    g.window = base;
}

function ensureDocumentPolyfill() {
    const g = globalThis as Record<string, unknown>;
    if (!g.document) g.document = createDocumentPolyfill();
}

function ensureUrlHelpers() {
    if (typeof URL === "undefined") return;
    if (typeof URL.createObjectURL !== "function") {
        URL.createObjectURL = () => "";
    }
    if (typeof URL.revokeObjectURL !== "function") {
        URL.revokeObjectURL = () => undefined;
    }
}

export function installBrowserPolyfills() {
    ensureEventCtor();
    ensureWindowPolyfill();
    ensureDocumentPolyfill();
    ensureUrlHelpers();
    installStoragePolyfill();
}
