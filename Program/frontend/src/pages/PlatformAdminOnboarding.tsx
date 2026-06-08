import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PrimaryNav from "../components/PrimaryNav";
import PageBack from "../components/PageBack";
import Card from "../components/common/Card";
import { UserServices, type PlatformCompanyOnboardingRequestDTO } from "../services/user-service/UserServices";
import "../stylesheets/PlatformAdmin.css";

type FormState = {
    companyName: string;
    adminFirstNames: string;
    adminSuffix: string;
    adminLastName: string;
    adminEmail: string;
};

const INITIAL_FORM: FormState = {
    companyName: "",
    adminFirstNames: "",
    adminSuffix: "",
    adminLastName: "",
    adminEmail: "",
};

export default function PlatformAdminOnboarding() {
    const navigate = useNavigate();
    const [form, setForm] = useState<FormState>(INITIAL_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const updateField = (field: keyof FormState, value: string) => {
        setForm((current) => ({ ...current, [field]: value }));
        if (error) setError(null);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
            setSaving(true);
            const payload: PlatformCompanyOnboardingRequestDTO = {
                companyName: form.companyName,
                adminFirstNames: form.adminFirstNames,
                adminMiddleNamePrefix: form.adminSuffix.trim() || null,
                adminLastName: form.adminLastName,
                adminEmail: form.adminEmail,
            };
            await UserServices.onboardPlatformCompany(payload);
            navigate("/platform/companies");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Could not create company.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <>
            <Navbar />
            <div className="managementPage platformAdminPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <main className="pageShellContent">
                        <div className="platformAdminHeaderBar">
                            <PageBack to="/platform" />
                        </div>
                        <header className="managementHeader">
                            <div>
                                <h1 className="managementTitle">Company onboarding</h1>
                                <p className="managementSubtitle">
                                    Create a company and its first admin in one simple step.
                                </p>
                            </div>
                        </header>
                        <Card title="New company" className="platformAdminFormCard">
                            <form className="platformAdminForm" onSubmit={handleSubmit}>
                                <label>
                                    <span>Company name</span>
                                    <input
                                        value={form.companyName}
                                        onChange={(event) => updateField("companyName", event.target.value)}
                                        required
                                    />
                                </label>
                                <label>
                                    <span>Admin first names</span>
                                    <input
                                        value={form.adminFirstNames}
                                        onChange={(event) => updateField("adminFirstNames", event.target.value)}
                                        required
                                    />
                                </label>
                                <label>
                                    <span>Admin suffix</span>
                                    <input
                                        value={form.adminSuffix}
                                        onChange={(event) => updateField("adminSuffix", event.target.value)}
                                    />
                                </label>
                                <label>
                                    <span>Admin last name</span>
                                    <input
                                        value={form.adminLastName}
                                        onChange={(event) => updateField("adminLastName", event.target.value)}
                                        required
                                    />
                                </label>
                                <label>
                                    <span>Admin email</span>
                                    <input
                                        type="email"
                                        value={form.adminEmail}
                                        onChange={(event) => updateField("adminEmail", event.target.value)}
                                        required
                                    />
                                </label>
                                {error ? <div className="settingsError">{error}</div> : null}
                                <div className="platformAdminFormActions">
                                    <button type="submit" className="button" disabled={saving}>
                                        {saving ? "Creating..." : "Create company"}
                                    </button>
                                </div>
                            </form>
                        </Card>
                    </main>
                </div>
            </div>
        </>
    );
}
