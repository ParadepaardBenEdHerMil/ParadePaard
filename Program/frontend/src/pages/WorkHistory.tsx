import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import Spinner from "../components/Spinner";
import Card from "../components/common/Card";
import { UserServices } from "../services/user-service/UserServices";
import "../stylesheets/WorkHistory.css";

export interface Timesheet {
    timesheetId: string;
    dateOfIssue: string;
    function: string;
    hoursWorked: number;
}

export default function WorkHistory() {
    const [timesheets, setTimesheets] = useState<Timesheet[]>([]);
    const [loading, setLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            try {
                setLoading(true);
                setErrorMsg(null);
                const data = await UserServices.getMyTimesheets();
                if (!cancelled) setTimesheets(data);
            } catch (err: unknown) {
                const message =
                    err instanceof Error ? err.message : "Failed to load work history";
                if (!cancelled) setErrorMsg(message);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, []);

    return (
        <>
            <Navbar />
            <div className="workHistoryPage">
                <div className="workHistoryShell">
                    <header className="workHistoryHeader">
                        <h1 className="workHistoryTitle">Work History</h1>
                        <p className="workHistorySubtitle">
                            A record of your past shifts and hours.
                        </p>
                    </header>

                    {loading ? (
                        <div className="workHistoryLoading">
                            <Spinner text="Loading work history" />
                        </div>
                    ) : errorMsg ? (
                        <div className="workHistoryError">{errorMsg}</div>
                    ) : (
                        <Card title="Timesheets" className="workHistoryCard">
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
                                        {timesheets.length === 0 ? (
                                            <tr>
                                                <td colSpan={3} className="workHistoryEmpty">
                                                    No timesheets found.
                                                </td>
                                            </tr>
                                        ) : (
                                            timesheets.map((t) => (
                                                <tr key={t.timesheetId}>
                                                    <td>{t.dateOfIssue}</td>
                                                    <td>{t.function}</td>
                                                    <td className="workHistoryHoursCol">
                                                        {t.hoursWorked.toFixed(1)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </>
    );
}

