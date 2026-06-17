import { useOutletContext } from "react-router-dom";
import Card from "../components/common/Card";
import type { ClientDetailOutletContext } from "./AdminPlanningClientDetail";

function clientInitial(name?: string | null): string {
    return (name?.trim()?.[0] ?? "C").toUpperCase();
}

function contactDisplayName(firstName?: string | null, lastName?: string | null): string {
    const parts = [firstName?.trim(), lastName?.trim()].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : "Unnamed contact";
}

export default function AdminPlanningClientGeneralInfo() {
    const { client, formatValue } = useOutletContext<ClientDetailOutletContext>();

    const contacts = client.contacts ?? [];
    const trimmedNotes = client.notes?.trim() ?? "";

    return (
        <>
            <Card title="Details">
                <div className="profile_avatar_body">
                    <div
                        className={`planningClientAvatar planningClientAvatar--large ${
                            client.profilePictureUrl ? "planningClientAvatar--image" : ""
                        }`}
                        aria-label="Client profile picture"
                    >
                        {client.profilePictureUrl ? (
                            <img
                                className="planningClientAvatarImage"
                                src={client.profilePictureUrl}
                                alt={`${client.name || "Client"} profile`}
                            />
                        ) : (
                            <span className="planningClientAvatarLetter">{clientInitial(client.name)}</span>
                        )}
                    </div>
                </div>
                <div className="generalInfoRows">
                    <div className="profile_info_row">
                        <span className="profile_info_label">Name</span>
                        <span className="profile_info_value">{formatValue(client.name)}</span>
                    </div>
                    <div className="profile_info_row">
                        <span className="profile_info_label">Address</span>
                        <span className="profile_info_value">{formatValue(client.address)}</span>
                    </div>
                    <div className="profile_info_row">
                        <span className="profile_info_label">Company line</span>
                        <span className="profile_info_value">{formatValue(client.companyLine)}</span>
                    </div>
                </div>
            </Card>

            <Card title="Contacts">
                {contacts.length === 0 ? (
                    <div className="generalInfoRows">
                        <div className="profile_info_row">
                            <span className="profile_info_label">Contacts</span>
                            <span className="profile_info_value">-</span>
                        </div>
                    </div>
                ) : (
                    contacts.map((contact, index) => (
                        <div
                            key={index}
                            className="generalInfoRows"
                            style={index > 0 ? { marginTop: "1rem" } : undefined}
                        >
                            <div className="profile_info_row">
                                <span className="profile_info_label">Contact</span>
                                <span className="profile_info_value">
                                    {contactDisplayName(contact.firstName, contact.lastName)}
                                </span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">First name</span>
                                <span className="profile_info_value">{formatValue(contact.firstName)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">Last name</span>
                                <span className="profile_info_value">{formatValue(contact.lastName)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">Position</span>
                                <span className="profile_info_value">{formatValue(contact.position)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">Email</span>
                                <span className="profile_info_value">{formatValue(contact.email)}</span>
                            </div>
                            <div className="profile_info_row">
                                <span className="profile_info_label">Phone</span>
                                <span className="profile_info_value">{formatValue(contact.phone)}</span>
                            </div>
                        </div>
                    ))
                )}
            </Card>

            <Card title="Notes">
                <div className="generalInfoRows">
                    <div className="profile_info_row">
                        <span className="profile_info_label">Notes</span>
                        <span className="profile_info_value">{trimmedNotes || "-"}</span>
                    </div>
                </div>
            </Card>
        </>
    );
}
