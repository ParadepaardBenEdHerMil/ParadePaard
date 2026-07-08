import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import Card from "../components/common/Card";
import ProfilePictureViewer from "../components/common/ProfilePictureViewer";
import type { AccountOutletContext } from "./Account";

export default function AccountPersonalInfo() {
    const {
        user,
        fullName,
        defaultAvatarLetter,
        profilePictureUrl,
        profilePictureLoading,
        avatarErrorMsg,
        formatValue,
        onSelectProfilePicture,
        onRemoveProfilePicture,
    } = useOutletContext<AccountOutletContext>();

    const [viewerOpen, setViewerOpen] = useState(false);
    const safeName = (fullName ?? "profile").trim().toLowerCase().replace(/\s+/g, "-") || "profile";
    const downloadName = `${safeName}-profile-picture.jpg`;

    return (
        <>
            <Card title="Personal information">
                <div className="profile_avatar_body">
                    <div
                        className={`profile_avatar_circle ${profilePictureUrl ? "profile_avatar_circle--image" : "profile_avatar_circle--default"}`}
                        aria-label="Profile picture"
                    >
                        {profilePictureUrl ? (
                            <button
                                type="button"
                                className="profile_avatar_view_button"
                                onClick={() => setViewerOpen(true)}
                                aria-label="View profile picture"
                            >
                                <img className="profile_avatar_img" src={profilePictureUrl} alt="Profile" />
                                <span className="profile_avatar_view_hint">View</span>
                            </button>
                        ) : (
                            <>
                                <span className="profile_avatar_letter">{defaultAvatarLetter}</span>
                                <label className="profile_avatar_overlay">
                                    Upload
                                    <input
                                        className="profile_avatar_file_input"
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            void onSelectProfilePicture(e.target.files?.[0] ?? null);
                                            e.target.value = "";
                                        }}
                                    />
                                </label>
                            </>
                        )}
                    </div>

                    <div className="profile_avatar_actions">
                        {profilePictureUrl ? (
                            <>
                                <label className="profile_avatar_change_btn">
                                    Change
                                    <input
                                        className="profile_avatar_file_input"
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                            void onSelectProfilePicture(e.target.files?.[0] ?? null);
                                            e.target.value = "";
                                        }}
                                    />
                                </label>
                                <button
                                    type="button"
                                    className="profile_avatar_remove_btn"
                                    onClick={() => void onRemoveProfilePicture()}
                                >
                                    Remove
                                </button>
                            </>
                        ) : (
                            <div className="profile_avatar_hint">
                                {profilePictureLoading ? "Loading..." : "No picture uploaded yet."}
                            </div>
                        )}
                        {avatarErrorMsg ? <div className="profile_avatar_error">{avatarErrorMsg}</div> : null}
                    </div>
                </div>
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

            <ProfilePictureViewer
                open={viewerOpen}
                src={profilePictureUrl}
                alt={`${fullName} profile picture`}
                downloadName={downloadName}
                onClose={() => setViewerOpen(false)}
            />
        </>
    );
}
