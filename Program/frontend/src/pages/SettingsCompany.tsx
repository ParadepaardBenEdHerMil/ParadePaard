import { useEffect, useMemo, useState } from "react";
import Card from "../components/common/Card";
import { AuthServices, type RoleResponseDTO } from "../services/auth-service/AuthServices";
import { UserServices, type UserResponseDTO } from "../services/user-service/UserServices";
import "../stylesheets/Settings.css";

const permissionLabelOverrides: Record<string, string> = {
    CAN_ACCESS_ADMIN_DASHBOARD: "Access admin dashboard",
    CAN_ASSIGN_ROLES: "Assign roles to users",
    CAN_CREATE_ROLE: "Create roles",
    CAN_MANAGE_USERS: "Manage users",
    CAN_VIEW_USERS: "View users",
};

const formatPermission = (value: string) => {
    if (permissionLabelOverrides[value]) return permissionLabelOverrides[value];
    const trimmed = value.replace(/^CAN_/, "");
    return trimmed
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .map((word) => word[0]?.toUpperCase() + word.slice(1))
        .join(" ");
};

const displayNameForUser = (user: UserResponseDTO) => {
    const parts = [user.firstNames, user.middleNamePrefix, user.lastName]
        .map((part) => (part ?? "").trim())
        .filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    const preferred = (user.preferredName ?? "").trim();
    return preferred || user.email;
};

export default function SettingsCompany() {
    const [permissions, setPermissions] = useState<string[]>([]);
    const [permissionsLoading, setPermissionsLoading] = useState(true);
    const [permissionsError, setPermissionsError] = useState<string | null>(null);

    const [roles, setRoles] = useState<RoleResponseDTO[]>([]);
    const [rolesLoading, setRolesLoading] = useState(false);
    const [rolesError, setRolesError] = useState<string | null>(null);

    const [permissionCatalog, setPermissionCatalog] = useState<string[]>([]);
    const [catalogLoading, setCatalogLoading] = useState(false);
    const [catalogError, setCatalogError] = useState<string | null>(null);

    const [users, setUsers] = useState<UserResponseDTO[]>([]);
    const [usersLoading, setUsersLoading] = useState(false);
    const [usersError, setUsersError] = useState<string | null>(null);

    const [roleName, setRoleName] = useState("");
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createSuccess, setCreateSuccess] = useState<string | null>(null);
    const [creatingRole, setCreatingRole] = useState(false);

    const [selectedUserId, setSelectedUserId] = useState("");
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [assignError, setAssignError] = useState<string | null>(null);
    const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
    const [assigningRoles, setAssigningRoles] = useState(false);

    useEffect(() => {
        let cancelled = false;
        setPermissionsLoading(true);
        setPermissionsError(null);

        AuthServices.getPermissions()
            .then((data) => {
                if (!cancelled) setPermissions(data ?? []);
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : "Failed to load permissions";
                if (!cancelled) setPermissionsError(message);
            })
            .finally(() => {
                if (!cancelled) setPermissionsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const canCreateRole = permissions.includes("CAN_CREATE_ROLE");
    const canAssignRoles = permissions.includes("CAN_ASSIGN_ROLES");
    const canManageRoles = canCreateRole || canAssignRoles;

    if (!permissionsLoading && !permissionsError && !canManageRoles) {
        return null;
    }

    useEffect(() => {
        if (!canManageRoles) return;
        let cancelled = false;
        setRolesLoading(true);
        setRolesError(null);

        AuthServices.getRoles()
            .then((data) => {
                if (!cancelled) setRoles(data ?? []);
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : "Failed to load roles";
                if (!cancelled) setRolesError(message);
            })
            .finally(() => {
                if (!cancelled) setRolesLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [canManageRoles]);

    useEffect(() => {
        if (!canCreateRole) return;
        let cancelled = false;
        setCatalogLoading(true);
        setCatalogError(null);

        AuthServices.getAllPermissions()
            .then((data) => {
                if (!cancelled) setPermissionCatalog(data ?? []);
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : "Failed to load permission catalog";
                if (!cancelled) setCatalogError(message);
            })
            .finally(() => {
                if (!cancelled) setCatalogLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [canCreateRole]);

    useEffect(() => {
        if (!canAssignRoles) return;
        let cancelled = false;
        setUsersLoading(true);
        setUsersError(null);

        UserServices.getUsers()
            .then((data) => {
                if (!cancelled) setUsers(data ?? []);
            })
            .catch((err: unknown) => {
                const message = err instanceof Error ? err.message : "Failed to load users";
                if (!cancelled) setUsersError(message);
            })
            .finally(() => {
                if (!cancelled) setUsersLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [canAssignRoles]);

    useEffect(() => {
        if (!selectedUserId && users.length > 0) {
            setSelectedUserId(users[0].userId);
        }
    }, [selectedUserId, users]);

    useEffect(() => {
        if (createSuccess) setCreateSuccess(null);
        if (createError) setCreateError(null);
    }, [roleName, selectedPermissions]);

    useEffect(() => {
        if (!selectedUserId) return;
        setSelectedRoles([]);
        setAssignSuccess(null);
        setAssignError(null);
    }, [selectedUserId]);

    const sortedRoles = useMemo(() => {
        return [...roles].sort((a, b) => a.name.localeCompare(b.name));
    }, [roles]);

    const sortedPermissions = useMemo(() => {
        return [...permissionCatalog].sort((a, b) => a.localeCompare(b));
    }, [permissionCatalog]);

    const canSubmitCreate =
        roleName.trim().length > 0 && selectedPermissions.length > 0 && !catalogLoading;

    const canSubmitAssign = Boolean(selectedUserId) && selectedRoles.length > 0;

    const handleTogglePermission = (permission: string) => {
        setSelectedPermissions((prev) =>
            prev.includes(permission)
                ? prev.filter((p) => p !== permission)
                : [...prev, permission]
        );
    };

    const handleToggleRole = (roleNameValue: string) => {
        setSelectedRoles((prev) =>
            prev.includes(roleNameValue)
                ? prev.filter((r) => r !== roleNameValue)
                : [...prev, roleNameValue]
        );
    };

    const handleCreateRole = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canCreateRole) return;

        const trimmedName = roleName.trim();
        if (!trimmedName) {
            setCreateError("Role name is required.");
            return;
        }
        if (selectedPermissions.length === 0) {
            setCreateError("Select at least one permission.");
            return;
        }

        try {
            setCreatingRole(true);
            setCreateError(null);
            setCreateSuccess(null);
            await AuthServices.createRole({
                name: trimmedName,
                permissions: selectedPermissions,
            });
            setCreateSuccess(`Role ${trimmedName.toUpperCase()} created.`);
            setRoleName("");
            setSelectedPermissions([]);
            const data = await AuthServices.getRoles();
            setRoles(data ?? []);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to create role";
            setCreateError(message);
        } finally {
            setCreatingRole(false);
        }
    };

    const handleAssignRoles = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!canAssignRoles) return;

        if (!selectedUserId) {
            setAssignError("Select a user.");
            return;
        }

        try {
            setAssigningRoles(true);
            setAssignError(null);
            setAssignSuccess(null);
            await AuthServices.setUserRoles(selectedUserId, selectedRoles);
            setAssignSuccess("Roles updated.");
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to update roles";
            setAssignError(message);
        } finally {
            setAssigningRoles(false);
        }
    };

    return (
        <>
            <div className="settingsSectionHeader">
                <div>
                    <h2 className="settingsSectionTitle">Company settings</h2>
                    <p className="settingsHelperText">
                        Control access by defining roles and assigning permissions.
                    </p>
                </div>
                {permissionsLoading ? (
                    <div className="settingsMeta">Loading permissions...</div>
                ) : null}
            </div>

            {permissionsError ? (
                <div className="settingsError">{permissionsError}</div>
            ) : null}

            <div className="settingsSectionGrid">
                <Card title="Roles">
                    <div className="settingsCardBody">
                        {rolesLoading ? <div className="settingsMeta">Loading roles...</div> : null}
                        {rolesError ? <div className="settingsError">{rolesError}</div> : null}
                        {!rolesLoading && !rolesError && roles.length === 0 ? (
                            <div className="settingsMeta">No roles defined yet.</div>
                        ) : null}
                        {!rolesLoading && !rolesError && roles.length > 0 ? (
                            <div className="settingsRoleList">
                                {sortedRoles.map((role) => (
                                    <div key={role.name} className="settingsRoleRow">
                                        <div className="settingsRoleHeader">
                                            <span className="settingsRoleName">{role.name}</span>
                                            <span className="settingsRoleCount">
                                                {role.permissions?.length ?? 0} permissions
                                            </span>
                                        </div>
                                        <div className="settingsPillRow">
                                            {(role.permissions ?? []).length === 0 ? (
                                                <span className="settingsMeta">No permissions assigned.</span>
                                            ) : (
                                                (role.permissions ?? []).map((permission) => (
                                                    <span key={permission} className="settingsPill">
                                                        {formatPermission(permission)}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </Card>

                {canCreateRole ? (
                    <Card title="Create role">
                        <div className="settingsCardBody">
                            <form onSubmit={handleCreateRole} className="settingsForm">
                                <label className="settingsField">
                                    <span className="settingsLabel">Role name</span>
                                    <input
                                        className="settingsInput"
                                        value={roleName}
                                        onChange={(e) => setRoleName(e.target.value)}
                                        placeholder="e.g. PAYROLL_MANAGER"
                                        disabled={creatingRole}
                                    />
                                </label>

                                <div className="settingsField">
                                    <div className="settingsLabelRow">
                                        <span className="settingsLabel">Permissions</span>
                                        <span className="settingsMeta">
                                            {selectedPermissions.length} selected
                                        </span>
                                    </div>
                                    {catalogLoading ? (
                                        <div className="settingsMeta">Loading permission catalog...</div>
                                    ) : catalogError ? (
                                        <div className="settingsError">{catalogError}</div>
                                    ) : (
                                        <div className="settingsCheckboxGrid">
                                            {sortedPermissions.map((permission) => (
                                                <label
                                                    key={permission}
                                                    className={`settingsCheckboxItem ${
                                                        selectedPermissions.includes(permission)
                                                            ? "settingsCheckboxItem--active"
                                                            : ""
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedPermissions.includes(permission)}
                                                        onChange={() => handleTogglePermission(permission)}
                                                        disabled={creatingRole}
                                                    />
                                                    <span>{formatPermission(permission)}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {createError ? <div className="settingsError">{createError}</div> : null}
                                {createSuccess ? (
                                    <div className="settingsSuccess">{createSuccess}</div>
                                ) : null}

                                <button
                                    className="button"
                                    type="submit"
                                    disabled={!canSubmitCreate || creatingRole}
                                >
                                    {creatingRole ? "Creating..." : "Create role"}
                                </button>
                            </form>
                        </div>
                    </Card>
                ) : null}

                {canAssignRoles ? (
                    <Card title="Assign roles">
                        <div className="settingsCardBody">
                            <form onSubmit={handleAssignRoles} className="settingsForm">
                                <label className="settingsField">
                                    <span className="settingsLabel">User</span>
                                    <select
                                        className="settingsSelect"
                                        value={selectedUserId}
                                        onChange={(e) => setSelectedUserId(e.target.value)}
                                        disabled={usersLoading || assigningRoles}
                                    >
                                        {users.length === 0 ? (
                                            <option value="">No users available</option>
                                        ) : (
                                            users.map((user) => (
                                                <option key={user.userId} value={user.userId}>
                                                    {displayNameForUser(user)} ({user.email})
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </label>

                                {usersLoading ? (
                                    <div className="settingsMeta">Loading users...</div>
                                ) : usersError ? (
                                    <div className="settingsError">{usersError}</div>
                                ) : null}

                                <div className="settingsField">
                                    <div className="settingsLabelRow">
                                        <span className="settingsLabel">Roles</span>
                                        <span className="settingsMeta">
                                            {selectedRoles.length} selected
                                        </span>
                                    </div>
                                    <div className="settingsCheckboxGrid">
                                        {sortedRoles.length === 0 ? (
                                            <span className="settingsMeta">No roles available.</span>
                                        ) : (
                                            sortedRoles.map((role) => (
                                                <label
                                                    key={role.name}
                                                    className={`settingsCheckboxItem ${
                                                        selectedRoles.includes(role.name)
                                                            ? "settingsCheckboxItem--active"
                                                            : ""
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedRoles.includes(role.name)}
                                                        onChange={() => handleToggleRole(role.name)}
                                                        disabled={assigningRoles}
                                                    />
                                                    <span>{role.name}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                    <div className="settingsMeta">
                                        Assigning roles replaces the user&apos;s existing roles.
                                    </div>
                                </div>

                                {assignError ? <div className="settingsError">{assignError}</div> : null}
                                {assignSuccess ? (
                                    <div className="settingsSuccess">{assignSuccess}</div>
                                ) : null}

                                <button
                                    className="button"
                                    type="submit"
                                    disabled={!canSubmitAssign || assigningRoles}
                                >
                                    {assigningRoles ? "Saving..." : "Update roles"}
                                </button>
                            </form>
                        </div>
                    </Card>
                ) : null}
            </div>
        </>
    );
}
