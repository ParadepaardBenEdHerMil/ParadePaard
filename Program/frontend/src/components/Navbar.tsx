import { type JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
    UserServices,
    type CompanyResponseDTO,
    type MessageRealtimeEventDTO,
    type UserResponseDTO,
} from "../services/user-service/UserServices";
import { clearAuthCache } from "../utils/authCache";
import { goBackOrFallback } from "../utils/backNavigation";
import { canAccessCompanySettings } from "../utils/permissionPolicy";
import AdminMessageDrawer from "./AdminMessageDrawer";
import { openCompanyMenu, openUserMenu } from "./navbarOverlayState";
import "../stylesheets/Navbar.css";

export default function Navbar(): JSX.Element {
    const location = useLocation();
    const navigate = useNavigate();
    const { setStatus, permissions, hasPermission } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const searchRef = useRef<HTMLDivElement | null>(null);
    const headerRef = useRef<HTMLElement | null>(null);
    const companyRef = useRef<HTMLDivElement | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarInitial, setAvatarInitial] = useState("P");
    const [avatarName, setAvatarName] = useState("Profile");
    const [searchTerm, setSearchTerm] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [users, setUsers] = useState<UserResponseDTO[]>([]);
    const [searchUsersLoaded, setSearchUsersLoaded] = useState(false);
    const [companyInfo, setCompanyInfo] = useState<CompanyResponseDTO | null>(null);
    const [companyOpen, setCompanyOpen] = useState(false);
    const [adminMessagesOpen, setAdminMessagesOpen] = useState(false);
    const [adminUnreadCount, setAdminUnreadCount] = useState(0);
    const adminUnreadByConvRef = useRef<Map<string, number>>(new Map());

    const sseBaseUrl = useMemo(() => {
        return (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4004").replace(/\/$/, "");
    }, []);

    const recomputeAdminUnread = useCallback(() => {
        let total = 0;
        for (const value of adminUnreadByConvRef.current.values()) {
            if (typeof value === "number" && value > 0) total += value;
        }
        setAdminUnreadCount(total);
    }, []);
    const currentPath = `${location.pathname}${location.search}`;
    const fallbackAccountReturnTo = "/dashboard";
    const accountReturnTo =
        location.pathname.startsWith("/account") &&
        location.state &&
        typeof location.state === "object" &&
        typeof (location.state as { accountReturnTo?: unknown }).accountReturnTo === "string"
            ? ((location.state as { accountReturnTo: string }).accountReturnTo)
            : location.pathname.startsWith("/account")
              ? fallbackAccountReturnTo
              : currentPath;
    const canViewUsers = hasPermission("CAN_VIEW_USERS");
    const canManageMessages = hasPermission("CAN_MANAGE_MESSAGES");
    const canManageCompany = canAccessCompanySettings(permissions);

    // Total unread messages across all admin conversations. Drives the badge on
    // the shared admin inbox button. Fetched once and then kept in sync via SSE
    // (same stream the AdminMessageDrawer uses) so it updates without polling.
    useEffect(() => {
        if (!canManageMessages) {
            adminUnreadByConvRef.current.clear();
            setAdminUnreadCount(0);
            return;
        }

        let cancelled = false;

        const loadInitial = async () => {
            try {
                const conversations = await UserServices.getAdminMessageConversations();
                if (cancelled) return;
                const next = new Map<string, number>();
                for (const conv of conversations) {
                    const id = conv.conversationId ?? null;
                    if (!id) continue;
                    next.set(id, Math.max(0, Math.floor(conv.unreadByAdminCount ?? 0)));
                }
                adminUnreadByConvRef.current = next;
                recomputeAdminUnread();
            } catch {
                // Network/permission failures simply leave the badge hidden.
            }
        };

        void loadInitial();

        if (typeof EventSource === "undefined") {
            const interval = window.setInterval(() => void loadInitial(), 4000);
            return () => {
                cancelled = true;
                window.clearInterval(interval);
            };
        }

        const source = new EventSource(
            `${sseBaseUrl}/api/messages/admin/conversations/stream`,
            { withCredentials: true }
        );

        source.onmessage = (evt: MessageEvent<string>) => {
            let data: MessageRealtimeEventDTO | null = null;
            try {
                data = JSON.parse(evt.data) as MessageRealtimeEventDTO;
            } catch {
                return;
            }

            const conversationId = data?.conversationId ?? null;
            if (!conversationId) return;

            const nextValue = Math.max(0, Math.floor(data?.unreadByAdminCount ?? 0));
            adminUnreadByConvRef.current.set(conversationId, nextValue);
            recomputeAdminUnread();
        };

        source.addEventListener("error", () => {
            // EventSource reconnects automatically; keep the last known counts.
        });

        return () => {
            cancelled = true;
            source.close();
        };
    }, [canManageMessages, recomputeAdminUnread, sseBaseUrl]);

    const adminUnreadLabel = adminUnreadCount > 99 ? "99+" : String(adminUnreadCount);
    const adminMessagesAriaLabel =
        adminUnreadCount > 0
            ? `Open shared admin inbox, ${adminUnreadLabel} unread`
            : "Open shared admin inbox";

    useEffect(() => {
        return () => {
            if (avatarUrl) URL.revokeObjectURL(avatarUrl);
        };
    }, [avatarUrl]);

    useEffect(() => {
        if (!canViewUsers) {
            setUsers([]);
            setSearchUsersLoaded(false);
            setSearchOpen(false);
            setSearchTerm("");
            setSearchLoading(false);
            setSearchError(null);
            return;
        }
        if (!searchOpen || searchUsersLoaded) return;

        let cancelled = false;

        const loadUsers = async () => {
            try {
                setSearchLoading(true);
                setSearchError(null);
                const data = await UserServices.getUsers();
                if (!cancelled) {
                    setUsers(data);
                    setSearchUsersLoaded(true);
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Failed to load users";
                if (!cancelled) setSearchError(message);
            } finally {
                if (!cancelled) setSearchLoading(false);
            }
        };

        void loadUsers();

        return () => {
            cancelled = true;
        };
    }, [canViewUsers, searchOpen, searchUsersLoaded]);

    useEffect(() => {
        if (!canManageCompany) {
            setCompanyInfo(null);
            setCompanyOpen(false);
            return;
        }
        let cancelled = false;

        const loadCompany = async () => {
            try {
                const data = await UserServices.getMyCompany();
                if (!cancelled) setCompanyInfo(data);
            } catch {
                if (!cancelled) setCompanyInfo(null);
            }
        };

        void loadCompany();

        const handleCompanyUpdated = () => {
            void loadCompany();
        };
        window.addEventListener("companyUpdated", handleCompanyUpdated);

        return () => {
            cancelled = true;
            window.removeEventListener("companyUpdated", handleCompanyUpdated);
        };
    }, [canManageCompany]);

    useEffect(() => {
        let cancelled = false;

        const loadInitial = async () => {
            try {
                const me = await UserServices.getMe();
                const fullName =
                    [me.firstNames, me.middleNamePrefix, me.lastName]
                        .map((part) => (part ?? "").trim())
                        .filter(Boolean)
                        .join(" ") ||
                    (me.preferredName ?? "").trim() ||
                    "";

                const displayName = fullName || me.email || "Profile";
                const initial = (fullName.trim()[0] ?? "P").toUpperCase();
                if (!cancelled) {
                    setAvatarInitial(initial);
                    setAvatarName(displayName);
                }
            } catch {
                // ignore
            }
        };

        const loadAvatar = async () => {
            try {
                const blob = await UserServices.getMyProfilePicture();
                if (cancelled) return;
                setAvatarUrl(blob ? URL.createObjectURL(blob) : null);
            } catch {
                if (!cancelled) setAvatarUrl(null);
            }
        };

        void loadInitial();
        void loadAvatar();

        const handleProfilePictureUpdated = () => {
            void loadAvatar();
        };
        window.addEventListener("profilePictureUpdated", handleProfilePictureUpdated);

        return () => {
            cancelled = true;
            window.removeEventListener("profilePictureUpdated", handleProfilePictureUpdated);
        };
    }, []);

    useEffect(() => {
        if (!menuOpen) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (menuRef.current && !menuRef.current.contains(target)) {
                setMenuOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setMenuOpen(false);
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("touchstart", handlePointerDown, { passive: true });
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("touchstart", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [menuOpen]);

    useEffect(() => {
        if (!companyOpen) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (companyRef.current && !companyRef.current.contains(target)) {
                setCompanyOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setCompanyOpen(false);
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("touchstart", handlePointerDown, { passive: true });
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("touchstart", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [companyOpen]);

    useEffect(() => {
        const node = headerRef.current;
        if (!node) return;

        const updateHeight = () => {
            const rect = node.getBoundingClientRect();
            const height = Math.ceil(rect.height);
            document.documentElement.style.setProperty("--navbar-height", `${height}px`);
        };

        updateHeight();

        let observer: ResizeObserver | null = null;
        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(() => updateHeight());
            observer.observe(node);
        } else {
            window.addEventListener("resize", updateHeight);
        }

        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", updateHeight);
        };
    }, []);

    useEffect(() => {
        if (!searchOpen) return;

        const handlePointerDown = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node | null;
            if (!target) return;
            if (searchRef.current && !searchRef.current.contains(target)) {
                setSearchOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") setSearchOpen(false);
        };

        document.addEventListener("mousedown", handlePointerDown);
        document.addEventListener("touchstart", handlePointerDown, { passive: true });
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("mousedown", handlePointerDown);
            document.removeEventListener("touchstart", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [searchOpen]);

    const displayNameForUser = (user: UserResponseDTO) => {
        const parts = [user.firstNames, user.middleNamePrefix, user.lastName]
            .map((part) => (part ?? "").trim())
            .filter(Boolean);
        if (parts.length > 0) return parts.join(" ");
        const preferred = (user.preferredName ?? "").trim();
        if (preferred) return preferred;
        return user.email;
    };

    const searchResults = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return [];
        return users
            .map((user) => ({
                user,
                name: displayNameForUser(user),
            }))
            .filter(({ user, name }) => {
                return (
                    name.toLowerCase().includes(term) ||
                    (user.preferredName ?? "").toLowerCase().includes(term) ||
                    user.email.toLowerCase().includes(term)
                );
            })
            .slice(0, 8);
    }, [searchTerm, users]);

    const companyName = (companyInfo?.name ?? "Company").trim() || "Company";
    const companyInitial = (companyName.trim()[0] ?? "C").toUpperCase();

    const handleSelectUser = (userId: string) => {
        setSearchTerm("");
        setSearchOpen(false);
        navigate(`/management/users/${userId}`);
    };

    const handleGoBack = () => {
        goBackOrFallback(navigate);
    };

    const handleCompanyMenuClick = () => {
        if (companyOpen) {
            setCompanyOpen(false);
            setAdminMessagesOpen(false);
            return;
        }

        const next = openCompanyMenu({ adminMessagesOpen, companyOpen, menuOpen });
        setAdminMessagesOpen(next.adminMessagesOpen);
        setCompanyOpen(next.companyOpen);
        setMenuOpen(next.menuOpen);
    };

    const handleUserMenuClick = () => {
        if (menuOpen) {
            setMenuOpen(false);
            setAdminMessagesOpen(false);
            return;
        }

        const next = openUserMenu({ adminMessagesOpen, companyOpen, menuOpen });
        setAdminMessagesOpen(next.adminMessagesOpen);
        setCompanyOpen(next.companyOpen);
        setMenuOpen(next.menuOpen);
    };

    async function handleLogout(): Promise<void> {
        setLoggingOut(true);
        try {
            localStorage.removeItem("token");
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("authToken");
            localStorage.removeItem("passwordResetToken");
            localStorage.removeItem("userStatus");
            clearAuthCache();
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("accessToken");
            sessionStorage.removeItem("refreshToken");
            sessionStorage.removeItem("authToken");
        } catch {
            // ignore storage failures (private mode, etc.)
        }

        try {
            const apiBaseUrl =
                import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4004";
            await fetch(`${apiBaseUrl}/auth/logout`, {
                method: "POST",
                credentials: "include",
            });
        } catch {
            // ignore logout network failures
        } finally {
            setStatus(null);
            setMenuOpen(false);
            setAvatarUrl(null);
            navigate("/login", { replace: true });
        }
    }

    return (
        <>
            {loggingOut ? (
                <div className="nav_logout_overlay" role="status" aria-live="polite">
                    <div className="nav_logout_card">
                        <div className="nav_logout_spinner" aria-hidden="true" />
                        <div className="nav_logout_text">Logging out...</div>
                    </div>
                </div>
            ) : null}

            <header className="nav_wrap" ref={headerRef}>
                <div className="nav_left">
                    <div className="nav_top">
                        <button
                            type="button"
                            className="nav_back_button"
                            aria-label="Go to previous page"
                            title="Back"
                            onClick={handleGoBack}
                            disabled={loggingOut}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M15 18l-6-6 6-6" />
                            </svg>
                        </button>
                        <div className="brand">
                            <span className="brand_main">ParadePaard</span>
                        </div>
                        {canViewUsers ? (
                            <div className="nav_search" ref={searchRef}>
                                <input
                                    className="nav_search_input"
                                    type="search"
                                    placeholder="Search users"
                                    aria-label="Search users"
                                    value={searchTerm}
                                    onFocus={() => setSearchOpen(true)}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setSearchOpen(true);
                                    }}
                                    disabled={loggingOut}
                                />
                                {searchOpen ? (
                                    <div className="nav_search_results" role="listbox">
                                        {searchLoading ? (
                                            <div className="nav_search_empty">Loading users...</div>
                                        ) : searchError ? (
                                            <div className="nav_search_empty">{searchError}</div>
                                        ) : searchTerm.trim().length === 0 ? (
                                            <div className="nav_search_empty">Start typing to search.</div>
                                        ) : searchResults.length === 0 ? (
                                            <div className="nav_search_empty">No matches found.</div>
                                        ) : (
                                            searchResults.map(({ user, name }) => (
                                                <button
                                                    key={user.userId}
                                                    type="button"
                                                    className="nav_search_item"
                                                    role="option"
                                                    onClick={() => handleSelectUser(user.userId)}
                                                >
                                                    <span className="nav_search_name">{name}</span>
                                                    <span className="nav_search_email">{user.email}</span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                    
                </div>

                <div className="nav_right">
                    {canManageCompany ? (
                        <div className="nav_company_menu" ref={companyRef}>
                            <button
                                type="button"
                                className="nav_company_button"
                                aria-haspopup="menu"
                                aria-expanded={companyOpen}
                                aria-label={companyName}
                                onClick={handleCompanyMenuClick}
                                title={companyName}
                            >
                                <span className="nav_company_avatar" aria-hidden="true">
                                    {companyInitial}
                                </span>
                                <span className="nav_company_name">{companyName}</span>
                            </button>
                            {companyOpen ? (
                                <div className="nav_dropdown nav_company_dropdown" role="menu">
                                    <div className="nav_company_header" role="presentation">
                                        <span className="nav_company_header_avatar" aria-hidden="true">
                                            {companyInitial}
                                        </span>
                                        <span className="nav_company_header_name" title={companyName}>
                                            {companyName}
                                        </span>
                                    </div>
                                    <Link
                                        className="nav_dropdown_item"
                                        role="menuitem"
                                        to="/account/company"
                                        state={{ accountReturnTo }}
                                        onClick={() => setCompanyOpen(false)}
                                    >
                                        Company settings
                                    </Link>
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                    {canManageMessages ? (
                        <button
                            type="button"
                            className={`nav_message_button${adminMessagesOpen ? " nav_message_button--active" : ""}`}
                            aria-label={adminMessagesAriaLabel}
                            aria-haspopup="dialog"
                            aria-expanded={adminMessagesOpen}
                            title="Shared admin inbox"
                            onClick={() => setAdminMessagesOpen((open) => !open)}
                            disabled={loggingOut}
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                            </svg>
                            {adminUnreadCount > 0 ? (
                                <span className="nav_message_badge" aria-hidden="true">
                                    {adminUnreadLabel}
                                </span>
                            ) : null}
                        </button>
                    ) : null}
                    <div className="nav_user_menu" ref={menuRef}>
                        <button
                            type="button"
                            className="nav_avatar_btn"
                            aria-label="Open user menu"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            onClick={handleUserMenuClick}
                            disabled={loggingOut}
                        >
                            <span
                                className={`nav_user_avatar ${
                                    avatarUrl ? "nav_user_avatar--image" : "nav_user_avatar--default"
                                }`}
                                aria-hidden="true"
                            >
                                {avatarUrl ? (
                                    <img
                                        className="nav_user_avatar_img"
                                        src={avatarUrl}
                                        alt=""
                                    />
                                ) : (
                                    avatarInitial
                                )}
                            </span>
                        </button>

                        {menuOpen && (
                            <div className="nav_dropdown" role="menu" aria-label="User menu">
                                <div className="nav_dropdown_header" role="presentation">
                                    <div className="nav_dropdown_label">Signed in as</div>
                                    <div className="nav_dropdown_name" title={avatarName}>
                                        {avatarName}
                                    </div>
                                </div>
                                <Link
                                    className="nav_dropdown_item"
                                    role="menuitem"
                                    to="/account"
                                    state={{ accountReturnTo }}
                                    onClick={() => setMenuOpen(false)}
                                >
                                    Account
                                </Link>
                                <button
                                    type="button"
                                    className="nav_dropdown_item nav_dropdown_button"
                                    role="menuitem"
                                    onClick={() => void handleLogout()}
                                    disabled={loggingOut}
                                >
                                    Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>
            {canManageMessages ? <AdminMessageDrawer open={adminMessagesOpen} /> : null}
        </>
    );
}
