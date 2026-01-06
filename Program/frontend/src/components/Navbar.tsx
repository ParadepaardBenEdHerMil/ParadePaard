import { type JSX, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthServices } from "../services/auth-service/AuthServices";
import { UserServices, type UserResponseDTO } from "../services/user-service/UserServices";
import "../stylesheets/Navbar.css";

export default function Navbar(): JSX.Element {
    const navigate = useNavigate();
    const { setStatus } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const searchRef = useRef<HTMLDivElement | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarInitial, setAvatarInitial] = useState("P");
    const [isAdmin, setIsAdmin] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState<string | null>(null);
    const [users, setUsers] = useState<UserResponseDTO[]>([]);
    const [canViewPayslips, setCanViewPayslips] = useState(false);

    useEffect(() => {
        return () => {
            if (avatarUrl) URL.revokeObjectURL(avatarUrl);
        };
    }, [avatarUrl]);

    useEffect(() => {
        let cancelled = false;

        AuthServices.isAdmin()
            .then((value) => {
                if (!cancelled) setIsAdmin(Boolean(value));
            })
            .catch(() => {
                if (!cancelled) setIsAdmin(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        AuthServices.getPermissions()
            .then((perms) => {
                if (cancelled) return;
                const list = perms ?? [];
                setCanViewPayslips(
                    list.includes("CAN_VIEW_PAYSLIPS") || list.includes("CAN_VIEW_ALL_PAYSLIPS")
                );
            })
            .catch(() => {
                if (!cancelled) setCanViewPayslips(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!isAdmin) return;
        let cancelled = false;

        const loadUsers = async () => {
            try {
                setSearchLoading(true);
                setSearchError(null);
                const data = await UserServices.getUsers();
                if (!cancelled) setUsers(data);
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
    }, [isAdmin]);

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

                const initial = (fullName.trim()[0] ?? "P").toUpperCase();
                if (!cancelled) setAvatarInitial(initial);
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

    const handleSelectUser = (userId: string) => {
        setSearchTerm("");
        setSearchOpen(false);
        navigate(`/admin/user/${userId}`);
    };

    async function handleLogout(): Promise<void> {
        setLoggingOut(true);
        try {
            localStorage.removeItem("token");
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            localStorage.removeItem("authToken");
            localStorage.removeItem("passwordResetToken");
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

            <header className="nav_wrap">
                <div className="nav_left">
                    <div className="brand">
                        <span className="brand_main">ParadePaard</span>
                    </div>
                </div>

                <div className="nav_right">
                    <Link
                        to="/dashboard"
                        className={`nav_quick_link ${loggingOut ? "nav_quick_link--disabled" : ""}`}
                        aria-label="Dashboard"
                        aria-disabled={loggingOut}
                        tabIndex={loggingOut ? -1 : 0}
                        onClick={(e) => {
                            if (loggingOut) e.preventDefault();
                        }}
                    >
                        <svg
                            className="nav_quick_icon"
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <path d="M3 11l9-8 9 8" />
                            <path d="M5 10v10h14V10" />
                        </svg>
                        <span className="nav_quick_text">Dashboard</span>
                    </Link>
                    <Link
                        to="/work-history"
                        className={`nav_quick_link ${loggingOut ? "nav_quick_link--disabled" : ""}`}
                        aria-label="Work history"
                        aria-disabled={loggingOut}
                        tabIndex={loggingOut ? -1 : 0}
                        onClick={(e) => {
                            if (loggingOut) e.preventDefault();
                        }}
                    >
                        <svg
                            className="nav_quick_icon"
                            viewBox="0 0 24 24"
                            width="18"
                            height="18"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v6l4 2" />
                        </svg>
                        <span className="nav_quick_text">Work history</span>
                    </Link>
                    {canViewPayslips ? (
                        <Link
                            to="/payslips"
                            className={`nav_quick_link ${loggingOut ? "nav_quick_link--disabled" : ""}`}
                            aria-label="Payslips"
                            aria-disabled={loggingOut}
                            tabIndex={loggingOut ? -1 : 0}
                            onClick={(e) => {
                                if (loggingOut) e.preventDefault();
                            }}
                        >
                            <svg
                                className="nav_quick_icon"
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
                                <path d="M14 3v5h5" />
                                <path d="M9 13h6" />
                                <path d="M9 17h6" />
                            </svg>
                            <span className="nav_quick_text">Payslips</span>
                        </Link>
                    ) : null}
                    {isAdmin ? (
                        <Link
                            to="/admin/users"
                            className={`nav_quick_link ${loggingOut ? "nav_quick_link--disabled" : ""}`}
                            aria-label="Users"
                            aria-disabled={loggingOut}
                            tabIndex={loggingOut ? -1 : 0}
                            onClick={(e) => {
                                if (loggingOut) e.preventDefault();
                            }}
                        >
                            <svg
                                className="nav_quick_icon"
                                viewBox="0 0 24 24"
                                width="18"
                                height="18"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            <span className="nav_quick_text">Users</span>
                        </Link>
                    ) : null}
                    {isAdmin ? (
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
                    <div className="nav_user_menu" ref={menuRef}>
                        <button
                            type="button"
                            className="nav_avatar_btn"
                            aria-label="Open user menu"
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            onClick={() => setMenuOpen((v) => !v)}
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
                                <Link
                                    className="nav_dropdown_item"
                                    role="menuitem"
                                    to="/profile"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    Profile
                                </Link>
                                <Link
                                    className="nav_dropdown_item"
                                    role="menuitem"
                                    to="/settings"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    Settings
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
        </>
    );
}
