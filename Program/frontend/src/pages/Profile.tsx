/* src/pages/Profile.tsx */
import { useEffect, useState } from "react";
import { UserServices, type UserResponseDTO } from "../services/user-service/UserServices";
import Spinner from "../components/Spinner";
import Card from "../components/common/Card";
import Navbar from "../components/Navbar";
import "../stylesheets/Profile.css";
import "../stylesheets/UserDashboard.css";

export default function Profile() {
    const [user, setUser] = useState<UserResponseDTO | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [avatarErrorMsg, setAvatarErrorMsg] = useState<string | null>(null);
    const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
    const [profilePictureLoading, setProfilePictureLoading] = useState(false);

    useEffect(() => {
        UserServices.getMe()
            .then((data) => setUser(data))
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

    if (error) return <div className="error-container">{error}</div>;
    if (!user) return <Spinner />;

    const formatValue = (value: string | number | boolean | null | undefined) => {
        if (value === null || value === undefined || value === "") return "-";
        if (typeof value === "boolean") return value ? "Yes" : "No";
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

        try {
            setAvatarErrorMsg(null);
            await UserServices.updateMyProfilePicture(file);

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
            <div className="userDashboardCard">
                <header className="pageHeader">
                    <h1 className="pageTitle">My Profile</h1>
                    <p className="pageSubtitle">Your personal and employment details</p>
                </header>

                <section className="dashboardGrid">
                    <Card
                        title="Profile Picture"
                        right={
                            <label className="profile_avatar_upload_btn button">
                                Upload
                                <input
                                    className="profile_avatar_file_input"
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) =>
                                        void handleSelectProfilePicture(e.target.files?.[0] ?? null)
                                    }
                                />
                            </label>
                        }
                    >
                        <div className="profile_avatar_body">
                            <div
                                className={`profile_avatar_circle ${
                                    profilePictureUrl ? "profile_avatar_circle--image" : "profile_avatar_circle--default"
                                }`}
                                aria-label="Profile picture"
                            >
                                {profilePictureUrl ? (
                                    <img
                                        className="profile_avatar_img"
                                        src={profilePictureUrl}
                                        alt="Profile"
                                    />
                                ) : (
                                    <span className="profile_avatar_letter">{defaultAvatarLetter}</span>
                                )}
                            </div>

                            <div className="profile_avatar_actions">
                                {profilePictureUrl ? (
                                    <button
                                        type="button"
                                        className="profile_avatar_remove_btn"
                                        onClick={() => void handleRemoveProfilePicture()}
                                    >
                                        Remove
                                    </button>
                                ) : (
                                    <div className="profile_avatar_hint">
                                        {profilePictureLoading ? "Loading..." : "No picture uploaded yet."}
                                    </div>
                                )}
                                {avatarErrorMsg ? (
                                    <div className="profile_avatar_error">{avatarErrorMsg}</div>
                                ) : null}
                            </div>
                        </div>
                    </Card>

                    <Card title="Personal Information">
                        <div className="generalInfoRows">
                            <div className="profile_info_row">
                                <span className="profile_info_label">Full Name</span>
                                <span className="profile_info_value">{fullName}</span>
                            </div>

                            <div className="profile_info_row">
                                <span className="profile_info_label">Preferred Name</span>
                                <span className="profile_info_value">{formatValue(user.preferredName)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">First Names</span>
                                <span className="profile_info_value">{formatValue(user.firstNames)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">Middle Name Prefix</span>
                                <span className="profile_info_value">{formatValue(user.middleNamePrefix)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">Last Name</span>
                                <span className="profile_info_value">{formatValue(user.lastName)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">Gender</span>
                                <span className="profile_info_value">{formatValue(user.gender)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">Date of Birth</span>
                                <span className="profile_info_value">{formatValue(user.dateOfBirth)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">Email</span>
                                <span className="profile_info_value">{formatValue(user.email)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">Mobile</span>
                                <span className="profile_info_value">{formatValue(user.mobileNumber)}</span>
                            </div>
                        </div>
                    </Card>

                    <Card title="Address">
                        <div className="generalInfoRows">
                            <div className="profile_info_row">
                                <span className="profile_info_label">Street</span>
                                <span className="profile_info_value">{formatValue(user.street)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">House Number</span>
                                <span className="profile_info_value">{formatValue(user.houseNumber)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">House Number Suffix</span>
                                <span className="profile_info_value">{formatValue(user.houseNumberSuffix)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">Postal Code</span>
                                <span className="profile_info_value">{formatValue(user.postalCode)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">City</span>
                                <span className="profile_info_value">{formatValue(user.city)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">Country</span>
                                <span className="profile_info_value">{formatValue(user.country)}</span>
                            </div>
                        </div>
                    </Card>

                    <Card title="Bank Details">
                        <div className="generalInfoRows">
                            <div className="profile_info_row">
                                <span className="profile_info_label">IBAN</span>
                                <span className="profile_info_value">{formatValue(user.iban)}</span>
                            </div>
                        </div>
                    </Card>

                    <Card title="Employment Details">
                        <div className="generalInfoRows">
                            <div className="profile_info_row">
                                <span className="profile_info_label">Position</span>
                                <span className="profile_info_value">{formatPosition(user.position)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">Worked For Us Before</span>
                                <span className="profile_info_value">{formatValue(user.workedForUsBefore)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">Status</span>
                                <span className="profile_info_value">{formatValue(user.status)}</span>
                            </div>
                        </div>
                    </Card>
                </section>
            </div>
        </>
    );
}
