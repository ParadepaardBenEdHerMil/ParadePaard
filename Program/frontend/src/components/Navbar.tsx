import { type JSX, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserServices } from "../services/user-service/UserServices";
import "../stylesheets/Navbar.css";

export default function Navbar(): JSX.Element {
    const navigate = useNavigate();
    const { setStatus } = useAuth();
    const [menuOpen, setMenuOpen] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);
    const menuRef = useRef<HTMLDivElement | null>(null);
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarInitial, setAvatarInitial] = useState("P");

    useEffect(() => {
        return () => {
            if (avatarUrl) URL.revokeObjectURL(avatarUrl);
        };
    }, [avatarUrl]);

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
