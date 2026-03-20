import React, {
    createContext,
    type ReactElement,
    type ReactNode,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { Pressable, Text } from "react-native";

type RouteProps = {
    path?: string;
    index?: boolean;
    element?: ReactNode;
    children?: ReactNode;
};

type NavigateOptions = {
    replace?: boolean;
};

type LocationState = {
    pathname: string;
    search: string;
    hash: string;
    state: unknown;
    key: string;
};

type RouterState = {
    entries: string[];
    index: number;
    navigate: (to: string | number, options?: NavigateOptions) => void;
};

type LinkProps = {
    to: string;
    children?: ReactNode;
    onClick?: (event: { preventDefault: () => void; defaultPrevented: boolean }) => void;
    role?: string;
    className?: string | ((props: { isActive: boolean }) => string);
    [key: string]: unknown;
};

type OutletRenderState = {
    outlet: ReactNode;
};

type SearchParamsInit =
    | string
    | URLSearchParams
    | Record<string, string | number | boolean | null | undefined>;

type RouteMatch = {
    route: RouteNode;
    params: Record<string, string>;
};

type RouteNode = {
    path?: string;
    index?: boolean;
    element?: ReactNode;
    children: RouteNode[];
};

const RouterContext = createContext<RouterState | null>(null);
const LocationContext = createContext<LocationState | null>(null);
const ParamsContext = createContext<Record<string, string>>({});
const OutletRenderContext = createContext<OutletRenderState | null>(null);
const OutletContext = createContext<unknown>(null);

function normalizePath(path: string): string {
    if (!path) return "/";
    const [pathname, search = ""] = path.split("?");
    const collapsed = pathname.replace(/\/+/g, "/");
    const trimmed =
        collapsed.length > 1 && collapsed.endsWith("/")
            ? collapsed.slice(0, -1)
            : collapsed;
    return search ? `${trimmed}?${search}` : trimmed;
}

function splitPathname(pathname: string): string[] {
    if (!pathname || pathname === "/") return [];
    return pathname.split("/").filter(Boolean);
}

function parseLocation(path: string): LocationState {
    const normalized = normalizePath(path);
    const [pathnamePart, searchPart = ""] = normalized.split("?");
    const pathname = pathnamePart || "/";
    const search = searchPart ? `?${searchPart}` : "";
    return {
        pathname,
        search,
        hash: "",
        state: null,
        key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };
}

function joinSearchParams(init: SearchParamsInit): string {
    if (typeof init === "string") {
        return init.startsWith("?") ? init.slice(1) : init;
    }
    if (init instanceof URLSearchParams) {
        return init.toString();
    }
    const params = new URLSearchParams();
    Object.entries(init).forEach(([key, value]) => {
        if (value === null || value === undefined) return;
        params.set(key, String(value));
    });
    return params.toString();
}

function routeNodeFromElement(element: ReactElement<RouteProps>): RouteNode {
    const props = element.props ?? {};
    const children = React.Children.toArray(props.children)
        .filter(React.isValidElement)
        .filter((child): child is ReactElement<RouteProps> => child.type === Route)
        .map(routeNodeFromElement);
    return {
        path: props.path,
        index: props.index,
        element: props.element,
        children,
    };
}

function resolveTarget(currentPath: string, to: string): string {
    if (to.startsWith("/")) return normalizePath(to);
    if (to.startsWith("?")) {
        const current = parseLocation(currentPath);
        return normalizePath(`${current.pathname}${to}`);
    }
    const current = parseLocation(currentPath);
    const base = splitPathname(current.pathname);
    const parts = to.split("/").filter(Boolean);
    parts.forEach((part) => {
        if (part === ".") return;
        if (part === "..") {
            base.pop();
            return;
        }
        base.push(part);
    });
    return normalizePath(`/${base.join("/")}`);
}

function setWindowHistoryLength(length: number) {
    const g = globalThis as Record<string, unknown>;
    const maybeWindow = g.window as { history?: { length?: number } } | undefined;
    if (maybeWindow?.history) {
        maybeWindow.history.length = length;
    }
}

function matchSegment(
    patternSegment: string,
    actualSegment: string
): { matched: boolean; paramKey?: string; paramValue?: string } {
    if (patternSegment.startsWith(":")) {
        return {
            matched: actualSegment.length > 0,
            paramKey: patternSegment.slice(1),
            paramValue: actualSegment,
        };
    }
    return { matched: patternSegment === actualSegment };
}

function matchRouteTree(
    routes: RouteNode[],
    pathnameSegments: string[],
    startIndex: number,
    parentParams: Record<string, string>
): RouteMatch[] | null {
    for (const route of routes) {
        const isIndex = Boolean(route.index);
        const pathValue = route.path;
        const params = { ...parentParams };
        let nextIndex = startIndex;

        if (isIndex) {
            if (startIndex !== pathnameSegments.length) continue;
        } else if (pathValue) {
            const absolute = pathValue.startsWith("/");
            const patternSegments = splitPathname(pathValue);
            const baseIndex = absolute ? 0 : startIndex;
            let matched = true;

            for (let i = 0; i < patternSegments.length; i += 1) {
                const actual = pathnameSegments[baseIndex + i];
                if (actual === undefined) {
                    matched = false;
                    break;
                }
                const result = matchSegment(patternSegments[i], actual);
                if (!result.matched) {
                    matched = false;
                    break;
                }
                if (result.paramKey && result.paramValue !== undefined) {
                    params[result.paramKey] = result.paramValue;
                }
            }

            if (!matched) continue;
            nextIndex = baseIndex + patternSegments.length;
        }

        if (route.children.length > 0) {
            const branch = matchRouteTree(route.children, pathnameSegments, nextIndex, params);
            if (branch) {
                return [{ route, params }, ...branch];
            }
        }

        if (nextIndex === pathnameSegments.length) {
            return [{ route, params }];
        }
    }

    return null;
}

function useRouterOrThrow(): RouterState {
    const ctx = useContext(RouterContext);
    if (!ctx) throw new Error("Router hook used outside BrowserRouter");
    return ctx;
}

export function BrowserRouter({ children }: { children: ReactNode }) {
    const initial = useMemo(() => {
        const g = globalThis as Record<string, unknown>;
        const maybeWindow = g.window as
            | { location?: { pathname?: string; search?: string } }
            | undefined;
        const pathname = maybeWindow?.location?.pathname ?? "/";
        const search = maybeWindow?.location?.search ?? "";
        return normalizePath(`${pathname}${search}`);
    }, []);

    const [entries, setEntries] = useState<string[]>([initial]);
    const [index, setIndex] = useState(0);

    const navigate = (to: string | number, options?: NavigateOptions) => {
        if (typeof to === "number") {
            setIndex((current) => {
                const next = Math.max(0, Math.min(entries.length - 1, current + to));
                setWindowHistoryLength(next + 1);
                return next;
            });
            return;
        }

        setEntries((currentEntries) => {
            const currentPath = currentEntries[index] ?? "/";
            const nextPath = resolveTarget(currentPath, to);

            if (options?.replace) {
                const copy = [...currentEntries];
                copy[index] = nextPath;
                setWindowHistoryLength(index + 1);
                return copy;
            }

            const nextEntries = currentEntries.slice(0, index + 1);
            nextEntries.push(nextPath);
            setIndex(nextEntries.length - 1);
            setWindowHistoryLength(nextEntries.length);
            return nextEntries;
        });
    };

    const state = useMemo<RouterState>(
        () => ({
            entries,
            index,
            navigate,
        }),
        [entries, index]
    );

    const location = useMemo(() => parseLocation(entries[index] ?? "/"), [entries, index]);

    return (
        <RouterContext.Provider value={state}>
            <LocationContext.Provider value={location}>{children}</LocationContext.Provider>
        </RouterContext.Provider>
    );
}

export function Routes({ children }: { children: ReactNode }) {
    const location = useLocation();
    const routeNodes = useMemo(() => {
        return React.Children.toArray(children)
            .filter(React.isValidElement)
            .filter((child): child is ReactElement<RouteProps> => child.type === Route)
            .map(routeNodeFromElement);
    }, [children]);

    const pathnameSegments = splitPathname(location.pathname);
    const matches = matchRouteTree(routeNodes, pathnameSegments, 0, {});
    if (!matches) return null;

    let rendered: ReactNode = null;
    let outletContextValue: unknown = null;

    for (let i = matches.length - 1; i >= 0; i -= 1) {
        const current = matches[i];
        const element = current.route.element ?? rendered;

        rendered = (
            <ParamsContext.Provider value={current.params}>
                <OutletContext.Provider value={outletContextValue}>
                    <OutletRenderContext.Provider value={{ outlet: rendered }}>
                        {element}
                    </OutletRenderContext.Provider>
                </OutletContext.Provider>
            </ParamsContext.Provider>
        );

        outletContextValue = null;
    }

    return <>{rendered}</>;
}

export function Route(_props: RouteProps) {
    return null;
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
    const { navigate } = useRouterOrThrow();
    const ran = useRef(false);

    useEffect(() => {
        if (ran.current) return;
        ran.current = true;
        navigate(to, { replace });
    }, [navigate, replace, to]);

    return null;
}

function normalizeLinkChildren(children: ReactNode): ReactNode {
    return React.Children.map(children, (child) => {
        if (child === null || child === undefined || typeof child === "boolean") return null;
        if (typeof child === "string" || typeof child === "number") {
            const text = String(child);
            if (text.trim().length === 0) return null;
            return <Text>{text}</Text>;
        }
        if (React.isValidElement(child) && child.type === React.Fragment) {
            const fragmentChildren = (child.props as { children?: ReactNode }).children;
            return <React.Fragment>{normalizeLinkChildren(fragmentChildren)}</React.Fragment>;
        }
        return child;
    });
}

export function Link({
    to,
    children,
    onClick,
    role: _role,
    className: _className,
    ...rest
}: LinkProps) {
    const { navigate } = useRouterOrThrow();

    return (
        <Pressable
            {...(rest as object)}
            onPress={() => {
                let prevented = false;
                onClick?.({
                    preventDefault: () => {
                        prevented = true;
                    },
                    get defaultPrevented() {
                        return prevented;
                    },
                });
                if (!prevented) navigate(to);
            }}
        >
            {normalizeLinkChildren(children)}
        </Pressable>
    );
}

export function NavLink({
    to,
    children,
    className,
    onClick,
    ...rest
}: LinkProps) {
    const location = useLocation();
    const isActive = location.pathname === resolveTarget(`${location.pathname}${location.search}`, to).split("?")[0];
    const resolvedClassName =
        typeof className === "function" ? className({ isActive }) : className;

    return (
        <Link
            {...rest}
            to={to}
            onClick={onClick}
            className={resolvedClassName}
            aria-current={isActive ? "page" : undefined}
        >
            {children}
        </Link>
    );
}

export function Outlet({ context }: { context?: unknown }) {
    const renderCtx = useContext(OutletRenderContext);
    if (!renderCtx) return null;
    if (renderCtx.outlet == null) return null;
    return <OutletContext.Provider value={context}>{renderCtx.outlet}</OutletContext.Provider>;
}

export function useOutletContext<T = unknown>() {
    return useContext(OutletContext) as T;
}

export function useNavigate() {
    return useRouterOrThrow().navigate;
}

export function useLocation(): LocationState {
    const location = useContext(LocationContext);
    if (!location) throw new Error("useLocation must be used within BrowserRouter");
    return location;
}

export function useParams<T extends Record<string, string | undefined> = Record<string, string>>() {
    return useContext(ParamsContext) as T;
}

export function useSearchParams(): [
    URLSearchParams,
    (nextInit: SearchParamsInit, options?: NavigateOptions) => void,
] {
    const location = useLocation();
    const { navigate } = useRouterOrThrow();
    const params = useMemo(() => new URLSearchParams(location.search), [location.search]);

    const setSearchParams = (nextInit: SearchParamsInit, options?: NavigateOptions) => {
        const query = joinSearchParams(nextInit);
        const next = `${location.pathname}${query ? `?${query}` : ""}`;
        navigate(next, options);
    };

    return [params, setSearchParams];
}
