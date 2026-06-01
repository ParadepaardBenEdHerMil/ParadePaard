import UserDashboard from "../components/Dashboards/UserDashboard";
import Navbar from "../components/Navbar";
import ContractSignReminderModal from "../components/ContractSignReminderModal";

export default function Dashboard() {
    return (
        <>
            <Navbar />
            <UserDashboard />
            {/* Pops up after login if the employee has a contract waiting for
                their signature, and links straight to the signing page. */}
            <ContractSignReminderModal />
        </>
    );
}
