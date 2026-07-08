import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import Spinner from "../components/Spinner";
import ProfilePictureCropper from "../components/common/ProfilePictureCropper";
import { UserServices, type UserResponseDTO } from "../services/user-service/UserServices";
import { formatMaybeDateTime } from "../utils/dateFormat";
import "../stylesheets/Profile.css";
import "../stylesheets/Settings.css";
import "../stylesheets/UserDashboard.css";

export type AccountOutletContext = {
    user: UserResponseDTO;
    fullName: string;
    defaultAvatarLetter: string;
    profilePictureUrl: string | null;
    profilePictureLoading: boolean;
    avatarErrorMsg: string | null;
    formatValue: (value: string | number | boolean | null | undefined) => string | number;
    formatPosition: (value: string | null | undefined) => string;
    onSelectProfilePicture: (file: File | null) => Promise<void>;
    onRemoveProfilePicture: () => Promise<void>;
};

type CompanySettingsTab = "details" | "roles" | "workflow";

const normalizeCompanySettingsTab = (value: string | null): CompanySettingsTab => {
    if (value === "roles" || value === "workflow") return value;
    return "details";
};

type AccountNavigationState = Record<string, unknown> & {
    accountReturnTo?: string;
};

export default function Account() {
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const activeCompanyTab = normalizeCompanySettingsTab(searchParams.get("tab"));
    const fallbackBackTo = "/dashboard";
    const locationState =
        location.state && typeof location.state === "object"
            ? (location.state as AccountNavigationState)
            : null;
    const backTo = locationState?.accountReturnTo ?? fallbackBackTo;
    const navState: AccountNavigationState =
        locationState?.accountReturnTo === backTo
            ? locationState
            : { ...(locationState ?? {}), accountReturnTo: backTo };
    const accountRoot = "/account";
    const accountBank = "/account/bank";
    const accountEmployment = "/account/employment";
    const accountCompanyDetails = "/account/company?tab=details";
    const accountCompanyRoles = "/account/company?tab=roles";
    const accountCompanyWorkflow = "/account/company?tab=workflow";
    const [user, setUser] = useState<UserResponseDTO | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [avatarErrorMsg, setAvatarErrorMsg] = useState<string | null>(null);
    const [avatarCropSource, setAvatarCropSource] = useState<File | null>(null);
    const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
    const [profilePictureLoading, setProfilePictureLoading] = useState(false);
    useEffect(() => {
        UserServices.getMe()
            .then((data) => {
                setUser(data);
            })
            .catch((err: Error) => setError(err.message));
    }, []);

    useEffect(() => {
        if (!user) return;
        let cancelled = false;
        setProfilePictureLoading(true);

        UserServices.getMyProfilePicture()
            .then((blob) => {
                if (cancelled) return;
                setProfilePictureUrl(blob ? URL.createObjectURL(blob) : null);
            })
            .catch(() => {
                if (!cancelled) setProfilePictureUrl(null);
            })
            .finally(() => {
                if (!cancelled) setProfilePictureLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [user?.userId]);

    useEffect(() => {
        return () => {
            if (profilePictureUrl) URL.revokeObjectURL(profilePictureUrl);
        };
    }, [profilePictureUrl]);

    const isCompanyPage = location.pathname.startsWith("/account/company");

    if (error) return <div className="error-container">{error}</div>;
    if (!user) return <Spinner text="Loading account" />;

    const formatValue = (value: string | number | boolean | null | undefined) => {
        if (value === null || value === undefined || value === "") return "-";
        if (typeof value === "boolean") return value ? "Yes" : "No";
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
            return formatMaybeDateTime(value);
        }
        return value;
    };

    const formatPosition = (value: string | null | undefined) => {
        if (value === null || value === undefined || value.trim() === "") return "-";
        const normalized = value.trim().toUpperCase();
        if (normalized === "BAR") return "Bar";
        if (normalized === "RUNNER") return "Runner";
        return value;
    };

    const fullName = (() => {
        const parts = [user.firstNames, user.middleNamePrefix, user.lastName]
            .map((p) => (p ?? "").trim())
            .filter(Boolean);
        if (parts.length > 0) return parts.join(" ");
        return (user.preferredName ?? "").trim() || "-";
    })();

    const defaultAvatarLetter = (fullName.trim()[0] ?? "?").toUpperCase();

    const handleSelectProfilePicture = async (file: File | null) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            setAvatarErrorMsg("Please select an image file.");
            return;
        }

        // Let the operator frame a circular crop before we upload the result.
        setAvatarErrorMsg(null);
        setAvatarCropSource(file);
    };

    const handleProfilePictureCropComplete = async (croppedFile: File) => {
        setAvatarCropSource(null);
        try {
            setAvatarErrorMsg(null);
            await UserServices.updateMyProfilePicture(croppedFile);

            const blob = await UserServices.getMyProfilePicture();
            setProfilePictureUrl(blob ? URL.createObjectURL(blob) : null);
            window.dispatchEvent(new Event("profilePictureUpdated"));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not upload profile picture.";
            setAvatarErrorMsg(message);
        }
    };

    const handleRemoveProfilePicture = async () => {
        try {
            setAvatarErrorMsg(null);
            await UserServices.deleteMyProfilePicture();
            setProfilePictureUrl(null);
            window.dispatchEvent(new Event("profilePictureUpdated"));
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Could not remove profile picture.";
            setAvatarErrorMsg(message);
        }
    };

    return (
        <>
            <Navbar />
            <div className="pageShell">
                <div className="accountLayout">
                    <aside className="accountSidebarHeader">
                        <header className="pageHeader">
                            <PageBack to={backTo} preferTarget />
                            <h1 className="pageTitle">
                                {isCompanyPage ? "Company settings" : "Account"}
                            </h1>
                        </header>
                    </aside>
                    <aside className="accountSidebarNav">
                        <nav className="settingsNav">
                            {isCompanyPage ? (
                                <>
                                    <NavLink
                                        to={accountCompanyDetails}
                                        state={navState}
                                        className={() =>
                                            `settingsNavLink ${activeCompanyTab === "details" ? "settingsNavLink--active" : ""}`
                                        }
                                    >
                                        Company details
                                    </NavLink>
                                    <NavLink
                                        to={accountCompanyRoles}
                                        state={navState}
                                        className={() =>
                                            `settingsNavLink ${activeCompanyTab === "roles" ? "settingsNavLink--active" : ""}`
                                        }
                                    >
                                        Roles and permissions
                                    </NavLink>
                                    <NavLink
                                        to={accountCompanyWorkflow}
                                        state={navState}
                                        className={() =>
                                            `settingsNavLink ${activeCompanyTab === "workflow" ? "settingsNavLink--active" : ""}`
                                        }
                                    >
                                        Workflow settings
                                    </NavLink>
                                </>
                            ) : (
                                <>
                                    <NavLink
                                        to={accountRoot}
                                        end
                                        state={navState}
                                        className={({ isActive }) =>
                                            `settingsNavLink ${isActive ? "settingsNavLink--active" : ""}`
                                        }
                                    >
                                        Personal info
                                    </NavLink>
                                    <NavLink
                                        to={accountBank}
                                        state={navState}
                                        className={({ isActive }) =>
                                            `settingsNavLink ${isActive ? "settingsNavLink--active" : ""}`
                                        }
                                    >
                                        Bank details
                                    </NavLink>
                                    <NavLink
                                        to={accountEmployment}
                                        state={navState}
                                        className={({ isActive }) =>
                                            `settingsNavLink ${isActive ? "settingsNavLink--active" : ""}`
                                        }
                                    >
                                        Employment details
                                    </NavLink>
                                </>
                            )}
                        </nav>
                    </aside>
                    <div className="accountMain">
                        <div className="accountMainInner">
                            <div className="userDashboardCard settingsCard accountPage">
                                <div className="settingsContent">
                                    <Outlet
                                        context={{
                                            user,
                                            fullName,
                                            defaultAvatarLetter,
                                            profilePictureUrl,
                                            profilePictureLoading,
                                            avatarErrorMsg,
                                            formatValue,
                                            formatPosition,
                                            onSelectProfilePicture: handleSelectProfilePicture,
                                            onRemoveProfilePicture: handleRemoveProfilePicture,
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ProfilePictureCropper
                sourceFile={avatarCropSource}
                onCropComplete={handleProfilePictureCropComplete}
                onCancel={() => setAvatarCropSource(null)}
            />
        </>
    );
}
