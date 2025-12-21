/* src/pages/Profile.tsx */
import { useEffect, useState } from "react";
// Import both the service and the type from the same file
import { UserServices, type UserResponseDTO } from "../services/user-service/UserServices";
import Spinner from "../components/Spinner";
import Card from "../components/common/Card";
import "../stylesheets/Profile.css";
import "../stylesheets/UserDashboard.css";

export default function Profile() {
    const [user, setUser] = useState<UserResponseDTO | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Referencing the centralized UserServices
        UserServices.getMe()
            .then((data) => setUser(data as UserResponseDTO))
            .catch((err: Error) => setError(err.message));
    }, []);

    if (error) return <div className="error-container">{error}</div>;
    if (!user) return <Spinner />;

    return (
        <div className="userDashboardCard">
            <header className="pageHeader">
                <h1 className="pageTitle">My Profile</h1>
                <p className="pageSubtitle">Manage your personal and employment details</p>
            </header>

            <section className="dashboardGrid">
                <Card title="Personal Information">
                    <div className="generalInfoRows">
                        <div className="profile_info_row">
                            <span className="profile_info_label">Full Name</span>
                            <span className="profile_info_value">{user.name}</span>
                        </div>
                        <div className="profile_info_row">
                            <span className="profile_info_label">Email</span>
                            <span className="profile_info_value">{user.email}</span>
                        </div>
                        <div className="profile_info_row">
                            <span className="profile_info_label">Phone</span>
                            <span className="profile_info_value">{user.phoneNumber}</span>
                        </div>
                    </div>
                </Card>

                <Card title="Address">
                    <div className="generalInfoRows">
                        <div className="profile_info_row">
                            <span className="profile_info_label">Street</span>
                            <span className="profile_info_value">{user.streetName} {user.houseNumber}</span>
                        </div>
                        <div className="profile_info_row">
                            <span className="profile_info_label">City</span>
                            <span className="profile_info_value">{user.city}</span>
                        </div>
                        <div className="profile_info_row">
                            <span className="profile_info_label">Country</span>
                            <span className="profile_info_value">{user.country}</span>
                        </div>
                    </div>
                </Card>

                <Card title="Employment">
                    <div className="generalInfoRows">
                        <div className="profile_info_row">
                            <span className="profile_info_label">Bank Account</span>
                            <span className="profile_info_value">{user.bankAccountNumber}</span>
                        </div>
                        <div className="profile_info_row">
                            <span className="profile_info_label">Leave Hours</span>
                            <span className="profile_info_value">{user.leaveHours}h</span>
                        </div>
                    </div>
                </Card>
            </section>
        </div>
    );
}