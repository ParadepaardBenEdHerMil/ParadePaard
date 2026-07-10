import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import PageBack from "../components/PageBack";
import PrimaryNav from "../components/PrimaryNav";
import Card from "../components/common/Card";
import "../stylesheets/Management.css";

// One card per sector. Adding a sector later is a data change here plus its own rules page;
// for now only Horeca is live. `to: null` renders a non-clickable "coming soon" card.
type SectorCard = {
    key: string;
    name: string;
    meta: string;
    description: string;
    to: string | null;
};

const SECTOR_CARDS: SectorCard[] = [
    {
        key: "horeca",
        name: "Horeca",
        meta: "Hospitality CAO",
        description:
            "Statutory wage table, tax and payroll, pension, holiday, and job-preset rules for the horeca CAO. Editing the wage table updates the minimum contract-service enforces.",
        to: "/management/horeca-payroll-rules",
    },
];

export default function ContractRules() {
    return (
        <>
            <Navbar />
            <div className="managementPage">
                <div className="pageShell">
                    <PrimaryNav />
                    <main className="pageShellContent">
                        <header className="managementHeader">
                            <PageBack to="/management" />
                            <div>
                                <h1 className="managementTitle">Payroll and Contract Rules</h1>
                                <p className="managementSubtitle">
                                    Choose a sector to manage its source-backed payroll and contract rules.
                                </p>
                            </div>
                        </header>

                        <div className="managementGrid">
                            {SECTOR_CARDS.map((sector) =>
                                sector.to ? (
                                    <Link
                                        key={sector.key}
                                        className="managementCardLink"
                                        to={sector.to}
                                        aria-label={`Open ${sector.name} rules`}
                                    >
                                        <Card title={sector.name} className="managementCard">
                                            <div className="managementCardBody">
                                                <span className="managementCardMeta">{sector.meta}</span>
                                                <p className="managementCardText">{sector.description}</p>
                                            </div>
                                        </Card>
                                    </Link>
                                ) : (
                                    <div
                                        key={sector.key}
                                        className="managementCardLink managementCardLink--disabled"
                                        aria-disabled="true"
                                    >
                                        <Card title={sector.name} className="managementCard">
                                            <div className="managementCardBody">
                                                <span className="managementCardMeta">{sector.meta}</span>
                                                <p className="managementCardText">{sector.description}</p>
                                            </div>
                                        </Card>
                                    </div>
                                )
                            )}
                        </div>
                    </main>
                </div>
            </div>
        </>
    );
}
