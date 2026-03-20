import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import { AuthServices } from "../services/auth-service/AuthServices";
import { UserServices, type UserResponseDTO } from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminUsers.css";

const statusLabel = (status?: string | null) => {
    const normalized = (status ?? "").toUpperCase();
    if (normalized === "ACTIVE") return "Active";
    if (normalized === "PENDING_SETUP") return "Pending setup";
    return status ?? "-";
};

const statusClass = (status?: string | null) => {
    const normalized = (status ?? "").toUpperCase();
    if (normalized === "ACTIVE") return "cellOk";
    if (normalized === "PENDING_SETUP") return "cellWarn";
    return "cellSub";
};

export default function AdminUsers() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserResponseDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [sortKey, setSortKey] = useState<"name" | "status" | "position" | "dateAdded">("name");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [tenureFilter, setTenureFilter] = useState<"all" | "new" | "longer">("all");
    const [rolesByUser, setRolesByUser] = useState<Record<string, string[]>>({});
    const [rolesLoading, setRolesLoading] = useState(false);

    const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});
    const avatarUrlsRef = useRef<Record<string, string | null>>({});
    const requestedRef = useRef(new Set<string>());

    const displayNameForUser = useCallback((user: UserResponseDTO) => {
        const parts = [user.firstNames, user.middleNamePrefix, user.lastName]
            .map((part) => (part ?? "").trim())
            .filter(Boolean);
        if (parts.length > 0) return parts.join(" ");
        const preferred = (user.preferredName ?? "").trim();
        if (preferred) return preferred;
        return user.email;
    }, []);

    const initialsForUser = useCallback(
        (user: UserResponseDTO) => {
            const name = displayNameForUser(user);
            const tokens = name.split(/\s+/).filter(Boolean);
            if (tokens.length === 0) return "U";
            const first = tokens[0][0] ?? "";
            if (tokens.length === 1) return first.toUpperCase();
            const last = tokens[tokens.length - 1][0] ?? "";
            const initials = (first + last).toUpperCase();
            return initials.length > 1 ? initials : first.toUpperCase();
        },
        [displayNameForUser]
    );

    const loadUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getUsers();
            Object.values(avatarUrlsRef.current).forEach((url) => {
                if (url) URL.revokeObjectURL(url);
            });
            avatarUrlsRef.current = {};
            requestedRef.current.clear();
            setAvatarUrls({});
            setUsers(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load users.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    useEffect(() => {
        let cancelled = false;

        const loadRoles = async () => {
            if (users.length === 0) {
                setRolesByUser({});
                return;
            }
            try {
                setRolesLoading(true);
                const ids = users.map((user) => user.userId);
                const data = await AuthServices.getUserRoles(ids);
                if (cancelled) return;
                const next: Record<string, string[]> = {};
                data.forEach((entry) => {
                    next[entry.userId] = entry.roles ?? [];
                });
                setRolesByUser(next);
            } catch {
                if (!cancelled) setRolesByUser({});
            } finally {
                if (!cancelled) setRolesLoading(false);
            }
        };

        void loadRoles();

        return () => {
            cancelled = true;
        };
    }, [users]);

    const filteredUsers = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        const now = new Date();
        const cutoff = new Date(now);
        cutoff.setDate(now.getDate() - 30);

        const parseDate = (value?: string | null) => {
            if (!value) return null;
            const datePart = value.split("T")[0].split(" ")[0];
            const [year, month, day] = datePart.split("-").map(Number);
            if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
            return new Date(year, month - 1, day);
        };

        const list = users
            .map((user) => ({
                user,
                name: displayNameForUser(user),
            }))
            .filter(({ user, name }) => {
                if (!term) return true;
                return (
                    name.toLowerCase().includes(term) ||
                    user.email.toLowerCase().includes(term)
                );
            })
            .filter(({ user }) => {
                if (tenureFilter === "all") return true;
                const registered = parseDate(user.registeredDate);
                if (!registered) return false;
                if (tenureFilter === "new") return registered >= cutoff;
                return registered < cutoff;
            })
            .sort((a, b) => {
                const direction = sortDirection === "asc" ? 1 : -1;
                const aDate = parseDate(a.user.registeredDate)?.getTime() ?? 0;
                const bDate = parseDate(b.user.registeredDate)?.getTime() ?? 0;
                const aValue =
                    sortKey === "status"
                        ? statusLabel(a.user.status)
                        : sortKey === "dateAdded"
                            ? String(aDate)
                        : sortKey === "position"
                            ? (a.user.position ?? "")
                            : a.name;
                const bValue =
                    sortKey === "status"
                        ? statusLabel(b.user.status)
                        : sortKey === "dateAdded"
                            ? String(bDate)
                        : sortKey === "position"
                            ? (b.user.position ?? "")
                            : b.name;
                if (sortKey === "dateAdded") {
                    return (aDate - bDate) * direction;
                }
                return aValue.localeCompare(bValue) * direction;
            });
        return list;
    }, [displayNameForUser, searchTerm, sortDirection, sortKey, tenureFilter, users]);

    const setAvatarUrl = useCallback((userId: string, url: string | null) => {
        setAvatarUrls((prev) => {
            const existing = prev[userId];
            if (existing && existing !== url) {
                URL.revokeObjectURL(existing);
            }
            const next = { ...prev, [userId]: url };
            avatarUrlsRef.current = next;
            return next;
        });
    }, []);

    useEffect(() => {
        return () => {
            Object.values(avatarUrlsRef.current).forEach((url) => {
                if (url) URL.revokeObjectURL(url);
            });
        };
    }, []);

    useEffect(() => {
        let cancelled = false;

        const loadAvatar = async (userId: string) => {
            try {
                const blob = await UserServices.getUserProfilePicture(userId);
                if (cancelled) return;
                const url = blob ? URL.createObjectURL(blob) : null;
                setAvatarUrl(userId, url);
            } catch {
                if (!cancelled) setAvatarUrl(userId, null);
            }
        };

        filteredUsers.forEach(({ user }) => {
            if (requestedRef.current.has(user.userId)) return;
            requestedRef.current.add(user.userId);
            void loadAvatar(user.userId);
        });

        return () => {
            cancelled = true;
        };
    }, [filteredUsers, setAvatarUrl]);

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <div className="pageShellContent">
                        <header className="pageHeader">
                            <h1 className="pageTitle">Users</h1>
                        </header>
                        <div className="adminDashboardCard">
                    <Card
                        title="All users"
                        right={
                            <div className="adminUsersToolbar">
                                <div className="adminUsersCount">
                                    {filteredUsers.length} of {users.length}
                                </div>
                                <input
                                    className="adminUsersSearchInput"
                                    type="search"
                                    placeholder="Search by name or email"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    disabled={loading}
                                />
                                <select
                                    className="uiSelect"
                                    value={sortKey}
                                    onChange={(e) =>
                                        setSortKey(e.target.value as "name" | "status" | "position" | "dateAdded")
                                    }
                                    disabled={loading}
                                    aria-label="Sort users by"
                                >
                                    <option value="name">Sort: Name</option>
                                    <option value="status">Sort: Status</option>
                                    <option value="position">Sort: Position</option>
                                    <option value="dateAdded">Sort: Date added</option>
                                </select>
                                <select
                                    className="uiSelect"
                                    value={sortDirection}
                                    onChange={(e) => setSortDirection(e.target.value as "asc" | "desc")}
                                    disabled={loading}
                                    aria-label="Sort direction"
                                >
                                    <option value="asc">A-Z</option>
                                    <option value="desc">Z-A</option>
                                </select>
                                <select
                                    className="uiSelect"
                                    value={tenureFilter}
                                    onChange={(e) => setTenureFilter(e.target.value as "all" | "new" | "longer")}
                                    disabled={loading}
                                    aria-label="Filter users by tenure"
                                >
                                    <option value="all">Tenure: All</option>
                                    <option value="new">Tenure: New (last 30 days)</option>
                                    <option value="longer">Tenure: Longer (30+ days)</option>
                                </select>
                                <button
                                    className="button buttonSecondary"
                                    onClick={() => void loadUsers()}
                                    disabled={loading}
                                >
                                    Refresh
                                </button>
                            </div>
                        }
                    >
                        <div className="listContainer">
                            <div className="listHeaderGrid gridUsers">
                                <div className="adminUsersHeaderUser">
                                    <span className="adminUsersHeaderSpacer" aria-hidden="true" />
                                    <span>User</span>
                                </div>
                                <div>Email</div>
                                <div>Position</div>
                                <div>Roles</div>
                                <div>Date added</div>
                                <div>Status</div>
                            </div>
                            <div className="listScrollArea adminUsersScroll">
                                {loading ? <div className="listEmpty">Loading users...</div> : null}
                                {error ? <div className="listEmpty errorText">{error}</div> : null}
                                {!loading && !error && filteredUsers.length === 0 ? (
                                    <div className="listEmpty">No users found.</div>
                                ) : null}

                                {!loading && !error
                                    ? filteredUsers.map(({ user, name }) => {
                                          const avatarUrl = avatarUrls[user.userId] ?? null;
                                          return (
                                              <div
                                                  key={user.userId}
                                                  className="listRowGrid gridUsers clickableRow"
                                                  onClick={() => navigate(`/admin/user/${user.userId}`)}
                                              >
                                                  <div className="adminUserCell">
                                                      <div
                                                          className={
                                                              avatarUrl
                                                                  ? "adminUserAvatar adminUserAvatar--image"
                                                                  : "adminUserAvatar"
                                                          }
                                                      >
                                                          {avatarUrl ? (
                                                              <img src={avatarUrl} alt="" />
                                                          ) : (
                                                              initialsForUser(user)
                                                          )}
                                                      </div>
                                                      <div className="adminUserMeta">
                                                          <div className="adminUserName">{name}</div>
                                                          <div className="adminUserSub">{user.userId}</div>
                                                      </div>
                                                  </div>
                                                  <div className="cellSub">{user.email}</div>
                                                  <div className="cellSub">{user.position ?? "-"}</div>
                                                  <div className="cellSub adminUserRoles">
                                                      {rolesByUser[user.userId]?.length
                                                          ? rolesByUser[user.userId].join(", ")
                                                          : rolesLoading
                                                              ? "Loading..."
                                                              : "-"}
                                                  </div>
                                                  <div className="cellSub">{formatDate(user.registeredDate)}</div>
                                                  <div className={statusClass(user.status)}>{statusLabel(user.status)}</div>
                                              </div>
                                          );
                                      })
                                    : null}
                            </div>
                        </div>
                    </Card>

                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
