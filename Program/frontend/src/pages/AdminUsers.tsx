import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import PaginationControls from "../components/common/PaginationControls";
import ProfilePictureViewer from "../components/common/ProfilePictureViewer";
import { FilterPanelBody, FilterToggleButton } from "../components/common/FilterPanel";
import type { FilterFieldConfig } from "../components/common/FilterPanel.types";
import { useFilterPanel } from "../components/common/useFilterPanel";
import { applyFilterRows, textIncludes } from "../utils/applyFilterRows";
import { AuthServices } from "../services/auth-service/AuthServices";
import { UserServices, type UserResponseDTO } from "../services/user-service/UserServices";
import { formatDate } from "../utils/dateFormat";

import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/AdminUsers.css";

const DEFAULT_PAGE_SIZE = 50;

const statusLabel = (status?: string | null) => {
    const normalized = (status ?? "").toUpperCase();
    if (normalized === "ACTIVE") return "Active";
    if (normalized === "PENDING_SETUP") return "Pending setup";
    if (normalized === "REJECTED") return "Rejected";
    return status ?? "-";
};

const statusClass = (status?: string | null) => {
    const normalized = (status ?? "").toUpperCase();
    if (normalized === "ACTIVE") return "cellOk";
    if (normalized === "PENDING_SETUP") return "cellWarn";
    if (normalized === "REJECTED") return "cellBad";
    return "cellSub";
};

const FILTER_FIELDS: FilterFieldConfig[] = [
    {
        field: "search",
        label: "Search",
        section: "Identity",
        placeholder: "Name or email",
        kind: { kind: "search" },
    },
    {
        field: "position",
        label: "Position",
        section: "Identity",
        placeholder: "Job position",
        kind: { kind: "text" },
    },
    {
        field: "status",
        label: "Status",
        section: "Status",
        kind: {
            kind: "select",
            options: [
                { value: "ACTIVE", label: "Active" },
                { value: "PENDING_SETUP", label: "Pending setup" },
                { value: "REJECTED", label: "Rejected" },
            ],
            emptyLabel: "Any status",
        },
    },
    {
        field: "tenure",
        label: "Tenure",
        section: "Tenure",
        kind: {
            kind: "select",
            options: [
                { value: "new", label: "New (last 30 days)" },
                { value: "longer", label: "Longer (30+ days)" },
            ],
            emptyLabel: "All",
        },
    },
];

export default function AdminUsers() {
    const navigate = useNavigate();
    const [users, setUsers] = useState<UserResponseDTO[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<"name" | "status" | "position" | "dateAdded">("name");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
    const [rolesByUser, setRolesByUser] = useState<Record<string, string[]>>({});
    const [rolesLoading, setRolesLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
    const [totalUsers, setTotalUsers] = useState(0);
    const [totalPages, setTotalPages] = useState(0);

    const filter = useFilterPanel({ fields: FILTER_FIELDS });

    const [avatarUrls, setAvatarUrls] = useState<Record<string, string | null>>({});
    const avatarUrlsRef = useRef<Record<string, string | null>>({});
    const requestedRef = useRef(new Set<string>());
    const [viewerUserId, setViewerUserId] = useState<string | null>(null);

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

    const loadUsers = useCallback(async (targetPage = page, targetPageSize = pageSize) => {
        try {
            setLoading(true);
            setError(null);
            const data = await UserServices.getUsersPage(targetPage, targetPageSize, sortKey, sortDirection);
            Object.values(avatarUrlsRef.current).forEach((url) => {
                if (url) URL.revokeObjectURL(url);
            });
            avatarUrlsRef.current = {};
            requestedRef.current.clear();
            setAvatarUrls({});
            setUsers(data.items);
            setPage(data.page);
            setTotalUsers(data.totalElements);
            setTotalPages(data.totalPages);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load users.";
            setError(message);
        } finally {
            setLoading(false);
        }
    }, [page, pageSize, sortDirection, sortKey]);

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
        const enriched = users.map((user) => ({ user, name: displayNameForUser(user) }));

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

        return applyFilterRows(enriched, filter.rows, {
            search: ({ user, name }, value) =>
                textIncludes(name, value) || textIncludes(user.email, value),
            position: ({ user }, value) => textIncludes(user.position ?? "", value),
            status: ({ user }, value) => (user.status ?? "").toUpperCase() === value.toUpperCase(),
            tenure: ({ user }, value) => {
                const registered = parseDate(user.registeredDate);
                if (!registered) return false;
                if (value === "new") return registered >= cutoff;
                if (value === "longer") return registered < cutoff;
                return true;
            },
        });
    }, [displayNameForUser, filter.rows, users]);

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
                            <PageBack to="/management" />
                            <h1 className="pageTitle">Users</h1>
                        </header>
                        <div className="adminDashboardCard">
                    <Card
                        title="All users"
                        right={
                            <div className="adminUsersToolbar">
                                <div className="adminUsersCount">
                                    {filteredUsers.length} of {users.length} on this page | {totalUsers} total
                                </div>
                                <FilterToggleButton controller={filter} />
                            </div>
                        }
                    >
                        <FilterPanelBody
                            controller={filter}
                            resultMeta={`${filteredUsers.length} of ${users.length} on this page`}
                            sort={{
                                label: "Sort by",
                                value: sortKey,
                                onChange: (value) => {
                                    setSortKey(value as "name" | "status" | "position" | "dateAdded");
                                    setPage(0);
                                },
                                options: [
                                    { value: "name", label: "Name" },
                                    { value: "status", label: "Status" },
                                    { value: "position", label: "Position" },
                                    { value: "dateAdded", label: "Date added" },
                                ],
                                direction: sortDirection,
                                onDirectionChange: (next) => {
                                    setSortDirection(next);
                                    setPage(0);
                                },
                                ascLabel: "A → Z",
                                descLabel: "Z → A",
                            }}
                        />
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
                                                  onClick={() => navigate(`/management/users/${user.userId}`)}
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
                                                              <button
                                                                  type="button"
                                                                  className="adminUserAvatarViewButton"
                                                                  onClick={(event) => {
                                                                      event.stopPropagation();
                                                                      setViewerUserId(user.userId);
                                                                  }}
                                                                  aria-label={`View profile picture for ${name}`}
                                                              >
                                                                  <img src={avatarUrl} alt="" />
                                                              </button>
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
                            <PaginationControls
                                page={page}
                                totalPages={totalPages}
                                pageSize={pageSize}
                                loading={loading}
                                onPageChange={(nextPage) => void loadUsers(nextPage)}
                                onPageSizeChange={(nextPageSize) => {
                                    setPageSize(nextPageSize);
                                    setPage(0);
                                    void loadUsers(0, nextPageSize);
                                }}
                            />
                        </div>
                    </Card>

                        </div>
                    </div>
                </div>
            </div>
            <ProfilePictureViewer
                open={viewerUserId !== null}
                src={viewerUserId ? avatarUrls[viewerUserId] ?? null : null}
                alt={(() => {
                    const entry = filteredUsers.find(({ user }) => user.userId === viewerUserId);
                    return entry ? `${entry.name} profile picture` : "Profile picture";
                })()}
                downloadName={(() => {
                    const entry = filteredUsers.find(({ user }) => user.userId === viewerUserId);
                    const base = entry ? entry.name : "user";
                    return `${base.trim().toLowerCase().replace(/\s+/g, "-")}-profile-picture.jpg`;
                })()}
                onClose={() => setViewerUserId(null)}
            />
        </>
    );
}
