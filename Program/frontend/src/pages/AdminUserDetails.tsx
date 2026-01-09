import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import Spinner from "../components/Spinner";
import Card from "../components/common/Card";
import { AuthServices, type RoleResponseDTO } from "../services/auth-service/AuthServices";
import {
    UserServices,
    type TimesheetRow,
    type UserResponseDTO,
} from "../services/user-service/UserServices";
import "../stylesheets/AdminDashboard.css";
import "../stylesheets/AdminLists.css";
import "../stylesheets/GeneralInfo.css";
import "../stylesheets/UserDashboard.css";
import "../stylesheets/WorkHistory.css";
import "../stylesheets/Profile.css";
import { formatDate } from "../utils/dateFormat";
import {
    buildTimeframeOptions,
    filterTimesheetsByTimeframe,
    getIsoWeek,
    sumHours,
    timeframeLabel,
    type Timeframe,
} from "../utils/hoursSummary";

const normalizeRoleName = (value: string) => value.trim().toUpperCase();

export default function AdminUserDetails() {
    const { userId } = useParams<{ userId: string }>();
    const [user, setUser] = useState<UserResponseDTO | null>(null);
    const [userLoading, setUserLoading] = useState(true);
    const [userError, setUserError] = useState<string | null>(null);
    const [timesheets, setTimesheets] = useState<TimesheetRow[]>([]);
    const [timesheetLoading, setTimesheetLoading] = useState(true);
    const [timesheetError, setTimesheetError] = useState<string | null>(null);
    const [timeframe, setTimeframe] = useState<Timeframe>({ kind: "all" });
    const [timeframeInitialized, setTimeframeInitialized] = useState(false);
    const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
    const [profilePictureLoading, setProfilePictureLoading] = useState(false);
    const [profilePictureError, setProfilePictureError] = useState<string | null>(null);
    const [permissions, setPermissions] = useState<string[]>([]);
    const [permissionsLoading, setPermissionsLoading] = useState(true);
    const [permissionsError, setPermissionsError] = useState<string | null>(null);
    const [userRoles, setUserRoles] = useState<string[]>([]);
    const [rolesLoading, setRolesLoading] = useState(false);
    const [rolesError, setRolesError] = useState<string | null>(null);
    const [roleOptions, setRoleOptions] = useState<RoleResponseDTO[]>([]);
    const [roleOptionsLoading, setRoleOptionsLoading] = useState(false);
    const [roleOptionsError, setRoleOptionsError] = useState<string | null>(null);
    const [roleSaveError, setRoleSaveError] = useState<string | null>(null);
    const [roleSaveSuccess, setRoleSaveSuccess] = useState<string | null>(null);
    const [roleSaving, setRoleSaving] = useState(false);
    const [showRolePicker, setShowRolePicker] = useState(false);
    const rolePickerRef = useRef<HTMLDivElement | null>(null);

    const uniqueRoles = useCallback((roles: string[]) => {
        const map = new Map<string, string>();
        roles.forEach((role) => {
            const key = normalizeRoleName(role);
            if (!key || map.has(key)) return;
            map.set(key, role);
        });
        return Array.from(map.values());
    }, []);

    const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
    const [dateOfIssue, setDateOfIssue] = useState(today);
    const [functionName, setFunctionName] = useState("");
    const [hoursWorked, setHoursWorked] = useState("");
    const [travelExpenses, setTravelExpenses] = useState("");
    const [saveError, setSaveError] = useState<string | null>(null);
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const loadUser = useCallback(async () => {
        if (!userId) {
            setUserError("Missing user id.");
            setUserLoading(false);
            return;
        }
        try {
            setUserLoading(true);
            setUserError(null);
            const data = await UserServices.getUserById(userId);
            setUser(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load user profile.";
            setUserError(message);
        } finally {
            setUserLoading(false);
        }
    }, [userId]);

    const loadTimesheets = useCallback(async () => {
        if (!userId) return;
        try {
            setTimesheetLoading(true);
            setTimesheetError(null);
            const data = await UserServices.getTimesheets();
            setTimesheets(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load timesheets.";
            setTimesheetError(message);
        } finally {
            setTimesheetLoading(false);
        }
    }, [userId]);

    const loadUserRoles = useCallback(async () => {
        if (!userId) return;
        try {
            setRolesLoading(true);
            setRolesError(null);
            const data = await AuthServices.getUserRoles([userId]);
            const roles = data[0]?.roles ?? [];
            setUserRoles(uniqueRoles(roles));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load user roles.";
            setRolesError(message);
        } finally {
            setRolesLoading(false);
        }
    }, [uniqueRoles, userId]);

    const loadRoleOptions = useCallback(async () => {
        try {
            setRoleOptionsLoading(true);
            setRoleOptionsError(null);
            const data = await AuthServices.getRoles();
            setRoleOptions(data ?? []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to load roles.";
            setRoleOptionsError(message);
        } finally {
            setRoleOptionsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadUser();
    }, [loadUser]);

    useEffect(() => {
        void loadTimesheets();
    }, [loadTimesheets]);

    useEffect(() => {
        let cancelled = false;
        setPermissionsLoading(true);
        setPermissionsError(null);

        AuthServices.getPermissions()
            .then((data) => {
                if (!cancelled) setPermissions(data ?? []);
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : "Failed to load permissions.";
                if (!cancelled) setPermissionsError(message);
            })
            .finally(() => {
                if (!cancelled) setPermissionsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        void loadUserRoles();
    }, [loadUserRoles]);

    useEffect(() => {
        void loadRoleOptions();
    }, [loadRoleOptions]);

    useEffect(() => {
        setRoleSaveError(null);
        setRoleSaveSuccess(null);
    }, [userId]);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        let objectUrl: string | null = null;

        setProfilePictureLoading(true);
        setProfilePictureError(null);
        setProfilePictureUrl(null);

        UserServices.getUserProfilePicture(userId)
            .then((blob) => {
                if (cancelled) return;
                if (blob) {
                    objectUrl = URL.createObjectURL(blob);
                    setProfilePictureUrl(objectUrl);
                } else {
                    setProfilePictureUrl(null);
                }
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : "Failed to load profile picture.";
                setProfilePictureError(message);
                setProfilePictureUrl(null);
            })
            .finally(() => {
                if (!cancelled) setProfilePictureLoading(false);
            });

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [userId]);

    useEffect(() => {
        setTimeframe({ kind: "all" });
        setTimeframeInitialized(false);
    }, [userId]);

    const displayName = useMemo(() => {
        if (!user) return "";
        const parts = [user.firstNames, user.middleNamePrefix, user.lastName]
            .map((part) => (part ?? "").trim())
            .filter(Boolean);
        if (parts.length > 0) return parts.join(" ");
        const preferred = (user.preferredName ?? "").trim();
        return preferred || user.email;
    }, [user]);

    const defaultAvatarLetter = useMemo(() => {
        const trimmed = displayName.trim();
        return (trimmed[0] ?? "?").toUpperCase();
    }, [displayName]);

    const navHeader = (
        <header className="pageHeader">
            <h1 className="pageTitle">User Details</h1>
        </header>
    );

    const formatValue = (value: string | number | boolean | null | undefined) => {
        if (value === null || value === undefined || value === "") return "-";
        if (typeof value === "boolean") return value ? "Yes" : "No";
        return value;
    };

    const canAssignRoles = permissions.includes("CAN_ASSIGN_ROLES");
    const canRemoveRoles = permissions.includes("CAN_REMOVE_ROLES");

    const sortedUserRoles = useMemo(() => {
        const list = uniqueRoles(userRoles);
        return [...list].sort((a, b) => a.localeCompare(b));
    }, [uniqueRoles, userRoles]);

    const availableRoles = useMemo(() => {
        const assigned = new Set(sortedUserRoles.map((role) => normalizeRoleName(role)));
        return roleOptions
            .map((role) => role.name)
            .filter((role) => !assigned.has(normalizeRoleName(role)))
            .sort((a, b) => a.localeCompare(b));
    }, [roleOptions, sortedUserRoles]);

    useEffect(() => {
        if (availableRoles.length === 0 && showRolePicker) {
            setShowRolePicker(false);
        }
    }, [availableRoles.length, showRolePicker]);

    const userTimesheets = useMemo(
        () => timesheets.filter((t) => t.userId === userId),
        [timesheets, userId]
    );

    const timeframeOptions = useMemo(
        () => buildTimeframeOptions(userTimesheets),
        [userTimesheets]
    );

    const yearOptions = useMemo(() => {
        const nowYear = new Date().getFullYear();
        const years = new Set<number>(timeframeOptions.years);
        years.add(nowYear);
        for (let i = 1; i <= 5; i++) years.add(nowYear - i);
        return [...years].sort((a, b) => b - a);
    }, [timeframeOptions.years]);

    useEffect(() => {
        if (timeframeInitialized) return;
        if (userTimesheets.length === 0) return;
        if (timeframeOptions.weeks.length > 0) {
            const latest = timeframeOptions.weeks[0];
            setTimeframe({ kind: "week", ...latest });
            setTimeframeInitialized(true);
        } else if (timeframeOptions.months.length > 0) {
            const latest = timeframeOptions.months[0];
            setTimeframe({ kind: "month", ...latest });
            setTimeframeInitialized(true);
        } else if (timeframeOptions.years.length > 0) {
            setTimeframe({ kind: "year", year: timeframeOptions.years[0] });
            setTimeframeInitialized(true);
        }
    }, [
        timeframeInitialized,
        timeframeOptions.months,
        timeframeOptions.weeks,
        timeframeOptions.years,
        userTimesheets.length,
    ]);

    const filteredTimesheets = useMemo(() => {
        const filtered = filterTimesheetsByTimeframe(userTimesheets, timeframe);
        return [...filtered].sort((a, b) => (b.dateOfIssue ?? "").localeCompare(a.dateOfIssue ?? ""));
    }, [userTimesheets, timeframe]);

    const totalHours = useMemo(() => sumHours(filteredTimesheets), [filteredTimesheets]);

    const handleCreateTimesheet = async (event: FormEvent) => {
        event.preventDefault();
        if (!user || !userId) return;

        const hours = Number(hoursWorked);
        const travel = travelExpenses.trim() === "" ? 0 : Number(travelExpenses);

        if (!dateOfIssue) {
            setSaveError("Please choose a date of issue.");
            return;
        }
        if (!functionName.trim()) {
            setSaveError("Please enter a function name.");
            return;
        }
        if (!Number.isFinite(hours) || hours <= 0) {
            setSaveError("Please enter a valid number of hours.");
            return;
        }
        if (!Number.isFinite(travel) || travel < 0) {
            setSaveError("Please enter a valid travel expense.");
            return;
        }

        try {
            setSaving(true);
            setSaveError(null);
            setSaveSuccess(null);
            await UserServices.createTimesheet({
                userId,
                name: displayName,
                dateOfIssue,
                function: functionName.trim(),
                hoursWorked: hours,
                travelExpenses: travel,
            });
            setHoursWorked("");
            setTravelExpenses("");
            setFunctionName("");
            setSaveSuccess("Timesheet added.");
            await loadTimesheets();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create timesheet.";
            setSaveError(message);
        } finally {
            setSaving(false);
        }
    };

    const updateUserRoles = async (nextRoles: string[], successMessage: string) => {
        if (!userId) return;
        try {
            setRoleSaving(true);
            setRoleSaveError(null);
            setRoleSaveSuccess(null);
            await AuthServices.setUserRoles(userId, nextRoles);
            setUserRoles(uniqueRoles(nextRoles));
            setRoleSaveSuccess(successMessage);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update roles.";
            setRoleSaveError(message);
        } finally {
            setRoleSaving(false);
        }
    };

    const handleRemoveRole = async (roleName: string) => {
        if (!canRemoveRoles) return;
        const normalized = normalizeRoleName(roleName);
        const nextRoles = sortedUserRoles.filter(
            (role) => normalizeRoleName(role) !== normalized
        );
        if (nextRoles.length === sortedUserRoles.length) return;
        await updateUserRoles(nextRoles, "Role removed.");
    };

    const handleAddRole = async (roleName: string) => {
        if (!canAssignRoles || !roleName) return;
        const nextRoles = uniqueRoles([...sortedUserRoles, roleName]);
        await updateUserRoles(nextRoles, "Role added.");
    };

    useEffect(() => {
        if (!showRolePicker) return;
        const handleClick = (event: MouseEvent) => {
            if (!rolePickerRef.current) return;
            const target = event.target as Node;
            if (rolePickerRef.current.contains(target)) return;
            setShowRolePicker(false);
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") setShowRolePicker(false);
        };
        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleKey);
        };
    }, [showRolePicker]);

    if (!userId) {
        return (
            <>
                <Navbar />
                <div className="adminDashboardPage">
                    <div className="pageShell">
                        <PrimaryNav header={navHeader} />
                        <div className="pageShellContent">
                            <div className="adminDashboardCard">
                                <div className="workHistoryError">Missing user id.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <Navbar />
            <div className="adminDashboardPage">
                <div className="pageShell">
                    <PrimaryNav header={navHeader} />
                    <div className="pageShellContent">
                        <div className="adminDashboardCard">
                    <main className="adminDashboardGrid">
                        <Card title="Profile" className="dashboardCardHeight">
                            {userLoading ? (
                                <p className="helperText">Loading user profile...</p>
                            ) : userError ? (
                                <p className="errorText">{userError}</p>
                            ) : user ? (
                                <div>
                                    <div className="profile_avatar_body">
                                        <div
                                            className={`profile_avatar_circle ${profilePictureUrl ? "profile_avatar_circle--image" : "profile_avatar_circle--default"}`}
                                            aria-label="Profile picture"
                                        >
                                            {profilePictureUrl ? (
                                                <img className="profile_avatar_img" src={profilePictureUrl} alt="Profile" />
                                            ) : (
                                                <span className="profile_avatar_letter">{defaultAvatarLetter}</span>
                                            )}
                                        </div>
                                        <div className="profile_avatar_actions">
                                            <div className="profile_avatar_hint">
                                                {profilePictureLoading
                                                    ? "Loading..."
                                                    : profilePictureUrl
                                                      ? "Profile picture"
                                                      : "No picture uploaded yet."}
                                            </div>
                                            {profilePictureError ? (
                                                <div className="profile_avatar_error">{profilePictureError}</div>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="profile_role_section">
                                        <div className="profile_role_header">Roles</div>
                                        {rolesLoading ? <div className="profile_role_hint">Loading roles...</div> : null}
                                        {rolesError ? <div className="profile_role_error">{rolesError}</div> : null}
                                        {roleOptionsError ? (
                                            <div className="profile_role_error">{roleOptionsError}</div>
                                        ) : null}
                                        {permissionsError ? (
                                            <div className="profile_role_error">{permissionsError}</div>
                                        ) : null}
                                        <div className="profile_role_list">
                                            {sortedUserRoles.length === 0 ? (
                                                <div className="profile_role_empty">No roles assigned.</div>
                                            ) : (
                                                sortedUserRoles.map((role) => {
                                                    const match = roleOptions.find(
                                                        (option) =>
                                                            normalizeRoleName(option.name) ===
                                                            normalizeRoleName(role)
                                                    );
                                                    const color = match?.color ?? "#9ca3af";
                                                    return (
                                                        <div key={role} className="profile_role_item">
                                                            <button
                                                                type="button"
                                                                className="profile_role_dot_button"
                                                                style={{ backgroundColor: color }}
                                                                onClick={() => void handleRemoveRole(role)}
                                                                disabled={!canRemoveRoles || roleSaving}
                                                                aria-label={`Remove role ${role}`}
                                                            >
                                                                <span
                                                                    className="profile_role_dot_cross"
                                                                    aria-hidden="true"
                                                                >
                                                                    x
                                                                </span>
                                                            </button>
                                                            <span className="profile_role_name">{role}</span>
                                                        </div>
                                                    );
                                                })
                                            )}
                                            {canAssignRoles ? (
                                                <div className="profile_role_add_wrap" ref={rolePickerRef}>
                                                    <button
                                                        type="button"
                                                        className="profile_role_add_icon"
                                                        onClick={() => setShowRolePicker((open) => !open)}
                                                        disabled={
                                                            roleSaving ||
                                                            roleOptionsLoading ||
                                                            availableRoles.length === 0
                                                        }
                                                        aria-label="Add role"
                                                    >
                                                        +
                                                    </button>
                                                    {showRolePicker && availableRoles.length > 0 ? (
                                                        <div
                                                            className="profile_role_menu"
                                                            role="listbox"
                                                            aria-label="Available roles"
                                                        >
                                                            {availableRoles.map((role) => (
                                                                <button
                                                                    key={role}
                                                                    type="button"
                                                                    className="profile_role_menu_item"
                                                                    onClick={() => {
                                                                        void handleAddRole(role);
                                                                        setShowRolePicker(false);
                                                                    }}
                                                                    role="option"
                                                                >
                                                                    {role}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </div>
                                        {!permissionsLoading && !canAssignRoles && !canRemoveRoles ? (
                                            <div className="profile_role_hint">
                                                You do not have permission to manage roles.
                                            </div>
                                        ) : null}
                                        {roleSaveError ? (
                                            <div className="profile_role_error">{roleSaveError}</div>
                                        ) : null}
                                        {roleSaveSuccess ? (
                                            <div className="profile_role_hint">{roleSaveSuccess}</div>
                                        ) : null}
                                    </div>
                                    <div className="generalInfoRows">
                                        <div className="generalInfoRow">
                                            <div className="generalInfoLabel">Full name</div>
                                            <div className="generalInfoValue">{displayName}</div>
                                        </div>
                                        <div className="generalInfoRow">
                                            <div className="generalInfoLabel">Email</div>
                                            <div className="generalInfoValue">{formatValue(user.email)}</div>
                                        </div>
                                        <div className="generalInfoRow">
                                            <div className="generalInfoLabel">Status</div>
                                            <div className="generalInfoValue">{formatValue(user.status)}</div>
                                        </div>
                                        <div className="generalInfoRow">
                                            <div className="generalInfoLabel">Position</div>
                                            <div className="generalInfoValue">{formatValue(user.position)}</div>
                                        </div>
                                        <div className="generalInfoRow">
                                            <div className="generalInfoLabel">Mobile</div>
                                            <div className="generalInfoValue">{formatValue(user.mobileNumber)}</div>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
                        </Card>

                        <Card title="Log Worked Hours" className="dashboardCardHeight">
                            <form onSubmit={handleCreateTimesheet}>
                                <div className="generalInfoRows">
                                    <div className="generalInfoRow">
                                        <label className="generalInfoLabel" htmlFor="admin-ts-date">
                                            Date
                                        </label>
                                        <input
                                            id="admin-ts-date"
                                            className="uiSelect"
                                            type="date"
                                            value={dateOfIssue}
                                            onChange={(e) => setDateOfIssue(e.target.value)}
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="generalInfoRow">
                                        <label className="generalInfoLabel" htmlFor="admin-ts-function">
                                            Function
                                        </label>
                                        <input
                                            id="admin-ts-function"
                                            className="uiSelect"
                                            type="text"
                                            value={functionName}
                                            onChange={(e) => setFunctionName(e.target.value)}
                                            placeholder="Runner shift"
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="generalInfoRow">
                                        <label className="generalInfoLabel" htmlFor="admin-ts-hours">
                                            Hours worked
                                        </label>
                                        <input
                                            id="admin-ts-hours"
                                            className="uiSelect"
                                            type="number"
                                            min="0"
                                            step="0.25"
                                            value={hoursWorked}
                                            onChange={(e) => setHoursWorked(e.target.value)}
                                            placeholder="0.0"
                                            disabled={saving}
                                        />
                                    </div>
                                    <div className="generalInfoRow">
                                        <label className="generalInfoLabel" htmlFor="admin-ts-travel">
                                            Travel expenses
                                        </label>
                                        <input
                                            id="admin-ts-travel"
                                            className="uiSelect"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={travelExpenses}
                                            onChange={(e) => setTravelExpenses(e.target.value)}
                                            placeholder="0.00"
                                            disabled={saving}
                                        />
                                    </div>
                                </div>

                                {saveError ? <p className="errorText">{saveError}</p> : null}
                                {saveSuccess ? <p className="helperText">{saveSuccess}</p> : null}

                                <div className="cardFooter">
                                    <button className="button" type="submit" disabled={saving || !user}>
                                        {saving ? "Saving..." : "Add timesheet"}
                                    </button>
                                </div>
                            </form>
                        </Card>

                        <Card
                            title={`Timesheets (${timeframeLabel(timeframe)})`}
                            className="workHistoryCard"
                            right={
                                <div className="workHistoryFilters">
                                    <select
                                        className="workHistorySelect"
                                        value={timeframe.kind}
                                        onChange={(e) => {
                                            const kind = e.target.value as Timeframe["kind"];
                                            if (kind === "all") setTimeframe({ kind });
                                            if (kind === "week") {
                                                const latest = timeframeOptions.weeks[0];
                                                const fallback = getIsoWeek(new Date());
                                                setTimeframe(latest ? { kind, ...latest } : { kind, ...fallback });
                                            }
                                            if (kind === "month") {
                                                const latest = timeframeOptions.months[0];
                                                const now = new Date();
                                                setTimeframe(
                                                    latest
                                                        ? { kind, ...latest }
                                                        : { kind, year: now.getFullYear(), month: now.getMonth() + 1 }
                                                );
                                            }
                                            if (kind === "year") {
                                                const latest = timeframeOptions.years[0];
                                                const nowYear = new Date().getFullYear();
                                                setTimeframe(typeof latest === "number" ? { kind, year: latest } : { kind, year: nowYear });
                                            }
                                        }}
                                        disabled={userTimesheets.length === 0}
                                        aria-label="Select timeframe type"
                                    >
                                        <option value="week">Week</option>
                                        <option value="month">Month</option>
                                        <option value="year">Year</option>
                                        <option value="all">All</option>
                                    </select>

                                    {timeframe.kind === "week" ? (
                                        <>
                                            <select
                                                className="workHistorySelect"
                                                value={String(timeframe.weekBasedYear)}
                                                onChange={(e) =>
                                                    setTimeframe({
                                                        kind: "week",
                                                        weekBasedYear: Number(e.target.value),
                                                        weekNumber: timeframe.weekNumber,
                                                    })
                                                }
                                                aria-label="Select week-based year"
                                            >
                                                {yearOptions.map((y) => (
                                                    <option key={y} value={String(y)}>
                                                        {y}
                                                    </option>
                                                ))}
                                            </select>
                                            <select
                                                className="workHistorySelect"
                                                value={String(timeframe.weekNumber)}
                                                onChange={(e) =>
                                                    setTimeframe({
                                                        kind: "week",
                                                        weekBasedYear: timeframe.weekBasedYear,
                                                        weekNumber: Number(e.target.value),
                                                    })
                                                }
                                                aria-label="Select week number"
                                            >
                                                {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
                                                    <option key={w} value={String(w)}>
                                                        Week {w}
                                                    </option>
                                                ))}
                                            </select>
                                        </>
                                    ) : null}

                                    {timeframe.kind === "month" ? (
                                        <>
                                            <select
                                                className="workHistorySelect"
                                                value={String(timeframe.year)}
                                                onChange={(e) =>
                                                    setTimeframe({ kind: "month", year: Number(e.target.value), month: timeframe.month })
                                                }
                                                aria-label="Select year"
                                            >
                                                {yearOptions.map((y) => (
                                                    <option key={y} value={String(y)}>
                                                        {y}
                                                    </option>
                                                ))}
                                            </select>
                                            <select
                                                className="workHistorySelect"
                                                value={String(timeframe.month)}
                                                onChange={(e) =>
                                                    setTimeframe({ kind: "month", year: timeframe.year, month: Number(e.target.value) })
                                                }
                                                aria-label="Select month"
                                            >
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                                                    <option key={m} value={String(m)}>
                                                        Month {String(m).padStart(2, "0")}
                                                    </option>
                                                ))}
                                            </select>
                                        </>
                                    ) : null}

                                    {timeframe.kind === "year" ? (
                                        <select
                                            className="workHistorySelect"
                                            value={String(timeframe.year)}
                                            onChange={(e) => setTimeframe({ kind: "year", year: Number(e.target.value) })}
                                            aria-label="Select year"
                                        >
                                            {yearOptions.map((y) => (
                                                <option key={y} value={String(y)}>
                                                    Year {y}
                                                </option>
                                            ))}
                                        </select>
                                    ) : null}
                                </div>
                            }
                        >
                            {timesheetLoading ? (
                                <div className="workHistoryLoading">
                                    <Spinner text="Loading work history" />
                                </div>
                            ) : timesheetError ? (
                                <div className="workHistoryError">{timesheetError}</div>
                            ) : (
                                <div className="workHistoryTableWrap">
                                    <table className="workHistoryTable">
                                        <thead>
                                            <tr>
                                                <th>Date</th>
                                                <th>Function</th>
                                                <th className="workHistoryHoursCol">Hours Worked</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredTimesheets.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="workHistoryEmpty">
                                                        No timesheets found for {timeframeLabel(timeframe)}.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredTimesheets.map((t) => (
                                                    <tr key={t.timesheetId}>
                                                        <td>{formatDate(t.dateOfIssue)}</td>
                                                        <td>{t.function}</td>
                                                        <td className="workHistoryHoursCol">{t.hoursWorked.toFixed(1)}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                        <tfoot>
                                            <tr className="workHistoryTotalRow">
                                                <td colSpan={2}>Total</td>
                                                <td className="workHistoryHoursCol">{totalHours.toFixed(1)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </Card>
                    </main>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
