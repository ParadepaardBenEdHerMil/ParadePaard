import { useEffect, useState } from "react";
import { AuthServices } from "../services/auth-service/AuthServices";
import AdminDashboard from "../components/Dashboards/AdminDashboard";
import UserDashboard from "../components/Dashboards/UserDashboard";
import Spinner from "../components/Spinner.tsx";
import Navbar from "../components/Navbar";

export default function Dashboard() {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        AuthServices.isAdmin()
            .then(setIsAdmin)
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : String(err));
            });
    }, []);

    if (error) return <div>{error}</div>;
    if (isAdmin === null) return <Spinner />;

    return (
        <>
            <Navbar />
            {isAdmin ? <AdminDashboard /> : <UserDashboard />}
        </>
    );
}
